/**
 * @file Casino WheelOfFortuneCommand - Gamble your chips at the wheel of fortune
 *
 * **Aliases**: `wheel`, `wof`
 * @module
 * @category casino
 * @name wheeloffortune
 * @example wof 5
 * @param {number} ChipsAmount The amount of chips you want to gamble
 */

import { ASSET_BASE_PATH, DEFAULT_EMBED_COLOR } from '@components/Constants';
import { deleteCommandMessages, roundNumber } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed, TextChannel } from 'awesome-djs';
import Database from 'better-sqlite3';
import { oneLine, stripIndent, stripIndents } from 'common-tags';
import moment from 'moment';
import path from 'path';

type WheelOfFortuneArgs = {
    chips: number;
};

export default class WheelOfFortuneCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'wheeloffortune',
            aliases: ['wheel', 'wof'],
            group: 'casino',
            memberName: 'wheeloffortune',
            description: 'Gamble your chips iat the wheel of fortune',
            format: 'AmountOfChips',
            examples: ['wof 50'],
            guildOnly: true,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'chips',
                    prompt: 'How many chips do you want to gamble?',
                    type: 'casino',
                }
            ],
        });
    }

    public run (msg: CommandoMessage, { chips }: WheelOfFortuneArgs) {
        const arrowmojis = ['⬆', '↖', '⬅', '↙', '⬇', '↘', '➡', '↗'];
        const conn = new Database(path.join(__dirname, '../../data/databases/casino.sqlite3'));
        const multipliers = [0.1, 0.2, 0.3, 0.5, 1.2, 1.5, 1.7, 2.4];
        const spin = Math.floor(Math.random() * multipliers.length);
        const wofEmbed = new MessageEmbed();

        wofEmbed
            .setAuthor(msg.member!.displayName, msg.author!.displayAvatarURL({ format: 'png' }))
            .setColor(msg.guild ? msg.guild.me!.displayHexColor : DEFAULT_EMBED_COLOR)
            .setThumbnail(`${ASSET_BASE_PATH}/ribbon/casinologo.png`);

        try {
            let { balance } = conn.prepare(`SELECT balance FROM "${msg.guild.id}" WHERE userID = ?;`).get(msg.author!.id);

            if (balance >= 0) {
                if (chips > balance) {
                    return msg.reply(`you don't have enough chips to make that bet. Use \`${msg.guild.commandPrefix}chips\` to check your current balance.`);
                }

                const prevBal = balance;

                balance -= chips;
                balance += chips * multipliers[spin];
                balance = roundNumber(balance);

                conn.prepare(`UPDATE "${msg.guild.id}" SET balance=$balance WHERE userID="${msg.author!.id}";`)
                    .run({ balance });

                wofEmbed
                    .setTitle(`
                        ${msg.author!.tag} ${multipliers[spin] < 1
                        ? `lost ${roundNumber(chips - chips * multipliers[spin])}`
                        : `won ${roundNumber(chips * multipliers[spin] - chips)}`
                        } chips
                    `)
                    .addField('Previous Balance', prevBal, true)
                    .addField('New Balance', balance, true)
                    .setDescription(stripIndent`
                      『${multipliers[1]}』   『${multipliers[0]}』   『${multipliers[7]}』

                      『${multipliers[2]}』      ${arrowmojis[spin]}        『${multipliers[6]}』

                      『${multipliers[3]}』   『${multipliers[4]}』   『${multipliers[5]}』
                    `);

                deleteCommandMessages(msg, this.client);

                return msg.embed(wofEmbed);
            }

            return msg.reply(oneLine`looks like you either don't have any chips yet or you used them all
                Run \`${msg.guild.commandPrefix}chips\` to get your first 500
                or run \`${msg.guild.commandPrefix}withdraw\` to withdraw some chips from your vault.`);
        } catch (err) {
            if (/(?:no such table|Cannot destructure property)/i.test(err.toString())) {
                conn.prepare(`CREATE TABLE IF NOT EXISTS "${msg.guild.id}" (userID TEXT PRIMARY KEY, balance INTEGER , lastdaily TEXT , lastweekly TEXT , vault INTEGER);`)
                    .run();

                return msg.reply(`looks like you don't have any chips yet, please use the \`${msg.guild.commandPrefix}chips\` command to get your first 500`);
            }
            const channel = this.client.channels.get(process.env.ISSUE_LOG_CHANNEL_ID!) as TextChannel;

            channel.send(stripIndents`
                <@${this.client.owners[0].id}> Error occurred in \`wheeloffortune\` command!
                **Server:** ${msg.guild.name} (${msg.guild.id})
                **Author:** ${msg.author!.tag} (${msg.author!.id})
                **Time:** ${moment(msg.createdTimestamp).format('MMMM Do YYYY [at] HH:mm:ss [UTC]Z')}
                **Error Message:** ${err}
            `);

            return msg.reply(oneLine`An unknown and unhandled error occurred but I notified ${this.client.owners[0].username}.
                Want to know more about the error? Join the support server by getting an invite by using the \`${msg.guild.commandPrefix}invite\` command `);
        }
    }
}
