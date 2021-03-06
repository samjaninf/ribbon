/**
 * @file Moderation CountdownList - List all stored countdown messages in the current guild
 *
 * **Aliases**: `cl`, `cdlist`
 * @module
 * @category moderation
 * @name countdownlist
 */

import { CountdownType } from '@components/Types';
import { deleteCommandMessages, shouldHavePermission } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { TextChannel, Util } from 'awesome-djs';
import Database from 'better-sqlite3';
import { oneLine, stripIndents } from 'common-tags';
import moment from 'moment';
import 'moment-duration-format';
import path from 'path';

export default class CountdownList extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'countdownlist',
            aliases: ['cd', 'cdlist'],
            group: 'moderation',
            memberName: 'countdownlist',
            description: 'List all stored countdown messages in the current guild',
            guildOnly: true,
            throttling: {
                usages: 2,
                duration: 3,
            },
        });
    }

    @shouldHavePermission('MANAGE_MESSAGES')
    public async run (msg: CommandoMessage) {
        const conn = new Database(path.join(__dirname, '../../data/databases/countdowns.sqlite3'));

        try {
            const list: CountdownType[] = conn.prepare(`SELECT * FROM "${msg.guild.id}"`).all();
            let body: string = '';

            list.forEach((row: CountdownType) =>
                body += `${stripIndents`
                    **id:** ${row.id}
                    **Event at:** ${moment(row.datetime).format('YYYY-MM-DD HH:mm')}
                    **Countdown Duration:** ${moment.duration(moment(row.datetime).diff(moment(), 'days'), 'days').format('w [weeks][, ] d [days] [and] h [hours]')}
                    **Tag on event:** ${row.tag === 'none' ? 'No one' : `@${row.tag}`}
                    **Channel:** <#${row.channel}> (\`${row.channel}\`)
                    **Content:** ${row.content}
                    **Last sent at:** ${moment(row.lastsend).format('YYYY-MM-DD HH:mm [UTC]Z')}`}
                \n`
            );

            deleteCommandMessages(msg, this.client);

            if (body.length >= 1800) {
                const splitContent: string[] = Util.splitMessage(body, { maxLength: 1800 }) as string[];

                splitContent.forEach(part => msg.embed({
                    color: msg.guild.me!.displayColor,
                    description: part,
                    title: 'Countdowns stored on this server',
                }));
                return null;
            }


            return msg.embed({
                color: msg.guild.me!.displayColor,
                description: body,
                title: 'Countdowns stored on this server',
            });
        } catch (err) {
            if (/(?:no such table)/i.test(err.toString())) {
                return msg.reply(`no countdowns found for this server. Start saving your first with ${msg.guild.commandPrefix}countdownadd`);
            }
            const channel = this.client.channels.get(process.env.ISSUE_LOG_CHANNEL_ID!) as TextChannel;

            channel.send(stripIndents`
                <@${this.client.owners[0].id}> Error occurred in \`countdownlist\` command!
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
