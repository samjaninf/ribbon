/**
 * @file Moderation UnknownMessagesCommand - Toggle Unknown Command messages on or off
 *
 * **Aliases**: `unknowns`, `unkmsg`
 * @module
 * @category moderation
 * @name unknownmessages
 * @example unknownmessages enable
 * @param {boolean} Option True or False
 */

import { deleteCommandMessages, logModMessage, shouldHavePermission } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed, TextChannel } from 'awesome-djs';

type UnknownMessagesArgs = {
    shouldEnable: true;
};

export default class UnknownMessagesCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'unknownmessages',
            aliases: ['unkmsg', 'unknowns'],
            group: 'moderation',
            memberName: 'unknownmessages',
            description: 'Toggle Unknown Command messages on or off',
            format: 'boolean',
            examples: ['unknownmessages enable'],
            guildOnly: true,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'shouldEnable',
                    prompt: 'Enable or disable Unknown Command messages?',
                    type: 'validboolean',
                }
            ],
        });
    }

    @shouldHavePermission('MANAGE_MESSAGES')
    public run (msg: CommandoMessage, { shouldEnable }: UnknownMessagesArgs) {
        const modlogChannel = msg.guild.settings.get('modlogchannel', null);
        const ukmEmbed = new MessageEmbed();

        msg.guild.settings.set('unknownmessages', shouldEnable);

        ukmEmbed
            .setColor('#3DFFE5')
            .setAuthor(msg.author!.tag, msg.author!.displayAvatarURL())
            .setDescription(`**Action:** Unknown command response messages are now ${shouldEnable ? 'enabled' : 'disabled'}`)
            .setTimestamp();

        if (msg.guild.settings.get('modlogs', true)) {
            logModMessage(msg, msg.guild, modlogChannel, msg.guild.channels.get(modlogChannel) as TextChannel, ukmEmbed);
        }

        deleteCommandMessages(msg, this.client);

        return msg.embed(ukmEmbed);
    }
}
