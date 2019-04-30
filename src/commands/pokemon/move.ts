/**
 * @file Pokémon MoveCommand - Gets information about a move in Pokémon
 *
 * For move names existing of multiple words (for example `dragon dance`) you can either type it with or without the space
 *
 * **Aliases**: `attack`
 * @module
 * @category pokémon
 * @name move
 * @example move dragon dance
 * @param {string} MoveName The move you want to find
 */

import { ASSET_BASE_PATH, DEFAULT_EMBED_COLOR } from '@components/Constants';
import { IPokeMoveAliases, PokeMoveDetailsType } from '@components/Types';
import { clientHasManageMessages, deleteCommandMessages, sentencecase } from '@components/Utils';
import { moveAliases } from '@pokedex/aliases';
import BattleMovedex from '@pokedex/moves';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed, TextChannel } from 'awesome-djs';
import { oneLine, stripIndents } from 'common-tags';
import Fuse, { FuseOptions } from 'fuse.js';
import moment from 'moment';

type MoveArgs = {
    move: string;
    hasManageMessages: boolean;
};

export default class MoveCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'move',
            aliases: ['attack'],
            group: 'pokemon',
            memberName: 'move',
            description: 'Get the info on a Pokémon move',
            format: 'MoveName',
            examples: ['move Dragon Dance'],
            guildOnly: false,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'move',
                    prompt: 'Get info on which move?',
                    type: 'string',
                    parse: (p: string) => p.toLowerCase(),
                }
            ],
        });
    }

    @clientHasManageMessages()
    public run (msg: CommandoMessage, { move, hasManageMessages }: MoveArgs) {
        try {
            const moveOptions: FuseOptions<PokeMoveDetailsType & IPokeMoveAliases> = {
                keys: ['alias', 'move', 'id', 'name'],
                threshold: 0.2,
            };
            const aliasFuse = new Fuse(moveAliases, moveOptions);
            const moveFuse = new Fuse(BattleMovedex, moveOptions);
            const aliasSearch = aliasFuse.search(move);
            let moveSearch = moveFuse.search(move);
            if (!moveSearch.length) moveSearch = aliasSearch.length ? moveFuse.search(aliasSearch[0].move) : [];
            if (!moveSearch.length) throw new Error('no_move');
            const hit = moveSearch[0];
            const moveEmbed = new MessageEmbed();

            moveEmbed
                .setColor(msg.guild ? msg.guild.me!.displayHexColor : DEFAULT_EMBED_COLOR)
                .setThumbnail(`${ASSET_BASE_PATH}/ribbon/unovadexclosedv2.png`)
                .setTitle(sentencecase(hit.name))
                .addField('Description', hit.desc ? hit.desc : hit.shortDesc)
                .addField('Type', hit.type, true)
                .addField('Base Power', hit.basePower, true)
                .addField('PP', hit.pp, true)
                .addField('Category', hit.category, true)
                .addField(
                    'Accuracy',
                    typeof hit.accuracy === 'boolean'
                        ? 'Certain Success'
                        : hit.accuracy,
                    true
                )
                .addField('Priority', hit.priority, true)
                .addField(
                    'Target',
                    hit.target === 'normal'
                        ? 'One Enemy'
                        : sentencecase(hit.target.replace(/([A-Z])/g, ' $1')
                        ),
                    true
                )
                .addField('Contest Condition', hit.contestType, true)
                .addField(
                    'Z-Crystal',
                    hit.isZ
                        ? `${sentencecase(hit.isZ.substring(0, hit.isZ.length - 1))}Z`
                        : 'None',
                    true
                )
                .addField('External Resources', oneLine`
                    [Bulbapedia](http://bulbapedia.bulbagarden.net/wiki/${hit.name.replace(/ /g, '_')}_(move\\))
                    |  [Smogon](http://www.smogon.com/dex/sm/moves/${hit.name.replace(/ /g, '_')})
                    |  [PokémonDB](http://pokemondb.net/move/${hit.name.replace(/ /g, '-')})
                    `
                );

            deleteCommandMessages(msg, this.client);

            return msg.embed(moveEmbed);
        } catch (err) {
            deleteCommandMessages(msg, this.client);

            if (/(?:no_move)/i.test(err.toString())) return msg.reply(stripIndents`no move found for \`${move}\``);
            const channel = this.client.channels.get(process.env.ISSUE_LOG_CHANNEL_ID!) as TextChannel;

            channel.send(stripIndents`
		        <@${this.client.owners[0].id}> Error occurred in \`move\` command!
                **Server:** ${msg.guild.name} (${msg.guild.id})
                **Author:** ${msg.author!.tag} (${msg.author!.id})
                **Time:** ${moment(msg.createdTimestamp).format('MMMM Do YYYY [at] HH:mm:ss [UTC]Z')}
                **Input:** ${move}
                **Error Message:** ${err}
            `);

            return msg.reply(oneLine`An unknown and unhandled error occurred but I notified ${this.client.owners[0].username}.
                Want to know more about the error? Join the support server by getting an invite by using the \`${msg.guild.commandPrefix}invite\` command `);
        }
    }
}
