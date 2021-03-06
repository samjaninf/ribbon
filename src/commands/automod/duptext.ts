/**
 * @file Automod DuplicateTextCommand - Toggle the duplicate text filter
 *
 * Uses the Levenshtein Distance Algorithm to determine similarity. If the distance is less than 10 the messages are
 *     considered duplicate.
 *
 * You can specify the minutes within messages should be checked (defaults to 3), the amount of allowed similar
 *     messages (defaults to 2) and the Levenshtein distance (defaults to 20)
 *
 * **Aliases**: `duplicatefilter`, `duplicatetextfilter`, `dtf`
 * @module
 * @category automod
 * @name duptext
 * @example duptext enable
 * @param {boolean} Option True or False
 * @param {number} [within] Amount of minutes between which text is checked
 * @param {number} [equals] Amount of similar messages before purging
 * @param {number} [distance] Levenshtein distance for similarity
 */

import { deleteCommandMessages, logModMessage, shouldHavePermission } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import { MessageEmbed, TextChannel } from 'awesome-djs';
import { stripIndents } from 'common-tags';

type DuplicateTextArgs = {
    shouldEnable: boolean;
    within: number;
    equals: number;
    distance: number
};

export default class DuplicateTextCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'duptext',
            aliases: ['duplicatefilter', 'duplicatetextfilter', 'dtf'],
            group: 'automod',
            memberName: 'duptext',
            description: 'Toggle the duplicate text filter',
            format: 'Option [within] [equals] [distance]',
            details: stripIndents`
                Uses the Levenshtein Distance Algorithm to determine similarity.
                If the distance is less than 10 the messages are considered duplicate.
                You can specify the minutes within messages should be checked (defaults to 3),
                the amount of allowed similar messages (defaults to 2) and the Levenshtein distance (defaults to 20)`,
            examples: ['duptext enable', 'duptext enable 3 2 20'],
            guildOnly: true,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'option',
                    prompt: 'Enable or disable the duplicate text filter?',
                    type: 'validboolean',
                },
                {
                    key: 'within',
                    prompt: 'Within how many minutes should duplicate messages be checked?',
                    type: 'integer',
                    default: 3,
                },
                {
                    key: 'equals',
                    prompt: 'How many similar messages can a member send before any being deleted?',
                    type: 'integer',
                    default: 2,
                },
                {
                    key: 'distance',
                    prompt: 'What is the levenshtein distance you want to use?',
                    type: 'integer',
                    default: 20,
                }
            ],
        });
    }

    @shouldHavePermission('MANAGE_MESSAGES', true)
    public run (msg: CommandoMessage, { shouldEnable, within, equals, distance }: DuplicateTextArgs) {
        const dtfEmbed = new MessageEmbed();
        const modlogChannel = msg.guild.settings.get('modlogchannel', null);
        const options = { distance, equals, within, enabled: shouldEnable };

        msg.guild.settings.set('duptext', options);

        dtfEmbed
            .setColor('#439DFF')
            .setAuthor(msg.author!.tag, msg.author!.displayAvatarURL())
            .setDescription(stripIndents`
                **Action:** Duplicate text filter has been ${shouldEnable ? 'enabled' : 'disabled'}
                ${shouldEnable ? `**Timeout:** Duplicate text is checked between messages sent in the past ${within} minutes` : ''}
                ${shouldEnable ? `**Duplicates:** Members can send ${equals} duplicate messages before any others are deleted` : ''}
                ${shouldEnable ? `**Distance:** Messages are deleted if they have a levenshtein distance of at least ${distance}` : ''}
                ${!msg.guild.settings.get('automod', false) ? `**Notice:** Be sure to enable the general automod toggle with the \`${msg.guild.commandPrefix}automod\` command!` : ''}`
            )
            .setTimestamp();

        if (msg.guild.settings.get('modlogs', true)) {
            logModMessage(msg, msg.guild, modlogChannel, msg.guild.channels.get(modlogChannel) as TextChannel, dtfEmbed);
        }

        deleteCommandMessages(msg, this.client);

        return msg.embed(dtfEmbed);
    }
}
