/**
 * @file Games DndCCommand - Flips a coin
 *
 * **Aliases**: `coinflip`, `dndc`, `dcoin`
 * @module
 * @category games
 * @name dndc
 */

import { ASSET_BASE_PATH, DEFAULT_EMBED_COLOR } from '@components/Constants';
import { deleteCommandMessages, roundNumber } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed } from 'awesome-djs';

export default class DndCCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'dndcoin',
            aliases: ['coinflip', 'dndc', 'dcoin'],
            group: 'games',
            memberName: 'dndcoin',
            description: 'Flips a coin',
            examples: ['coin'],
            guildOnly: false,
            throttling: {
                usages: 2,
                duration: 3,
            },
        });
    }

    public run (msg: CommandoMessage) {
        const coinEmbed = new MessageEmbed();
        const flip = roundNumber(Math.random());

        coinEmbed
            .setColor(msg.guild ? msg.guild.me!.displayHexColor : DEFAULT_EMBED_COLOR)
            .setImage(
                flip === 1
                    ? `${ASSET_BASE_PATH}/ribbon/dndheads.png`
                    : `${ASSET_BASE_PATH}/ribbon/dndtails.png`
            )
            .setTitle(`Flipped ${flip === 1 ? 'heads' : 'tails'}`);

        deleteCommandMessages(msg, this.client);

        return msg.embed(coinEmbed);
    }
}
