/**
 * @file Moderation SelfRolesCommand - Sets the self assignable roles for the server members, to be used by the `iam`
 *     command
 *
 * You can set multiple roles by delimiting with spaces (`role1 role2`)
 *
 * You can clear the setting by giving no roles then replying `finish`
 *
 * **Aliases**: `sroles`
 * @module
 * @category moderation
 * @name selfroles
 * @example selfroles uploader
 * @example selfroles uploader superuploader
 * @param {RoleResolvable} [AnyRole] Role to set, can be multiple split by spaces
 */

import { deleteCommandMessages, logModMessage, shouldHavePermission } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed, Role, Snowflake, TextChannel } from 'awesome-djs';
import { oneLine, stripIndents } from 'common-tags';

type SelfRolesArgs = {
    roles: Role[];
    roleIDs: Snowflake[];
    roleNames: string[];
};

export default class SelfRolesCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'selfroles',
            aliases: ['sroles'],
            group: 'moderation',
            memberName: 'selfroles',
            description: 'Sets the self assignable roles for the server members, to be used by the `iam` command',
            format: 'RoleID|RoleName(partial or full)',
            details: stripIndents`You can set multiple roles by delimiting with spaces (\`role1 role2\`)
                            You can clear the setting by giving no roles then replying \`finish\``,
            examples: ['selfroles uploader', 'selfroles uploader superuploader'],
            guildOnly: true,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'roles',
                    prompt: 'Which role would you like to set as the default role?',
                    type: 'role',
                    default: [],
                    infinite: true,
                }
            ],
        });
    }

    @shouldHavePermission('MANAGE_ROLES', true)
    public run (msg: CommandoMessage, { roles, roleIDs = [], roleNames = [] }: SelfRolesArgs) {
        const modlogChannel = msg.guild.settings.get('modlogchannel', null);
        const selfRolesEmbed = new MessageEmbed();
        let description = '';

        if (!roles.length) {
            description = 'self assignable roles have been removed, members who previously gave themselves a role will keep that role!';
            msg.guild.settings.remove('selfroles');
        } else {
            roles.forEach(role => roleIDs.push(role.id));
            roles.forEach(role => roleNames.push(role.name));
            description = oneLine`self assignable roles have been set to ${roleNames.map(role => `\`${role}\``).join(', ')}`;
            msg.guild.settings.set('selfroles', roleIDs);
        }

        selfRolesEmbed
            .setColor('#AAEFE6')
            .setAuthor(msg.author!.tag, msg.author!.displayAvatarURL())
            .setDescription(stripIndents`**Action:** ${description}`)
            .setTimestamp();

        if (msg.guild.settings.get('modlogs', true)) {
            logModMessage(msg, msg.guild, modlogChannel, msg.guild.channels.get(modlogChannel) as TextChannel, selfRolesEmbed);
        }

        deleteCommandMessages(msg, this.client);

        return msg.embed(selfRolesEmbed);
    }
}
