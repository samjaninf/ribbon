import { ArgumentCollectorResult, CommandoClient, CommandoGuild, CommandoMessage, util as CommandoUtil } from 'awesome-commando';
import { GuildMember, MessageEmbed, PermissionString, StreamDispatcher, TextChannel, Util } from 'awesome-djs';
import { oneLine, oneLineTrim, stripIndents } from 'common-tags';
import emojiRegex from 'emoji-regex';
import { diacriticsMap, validBooleansMap } from './Constants';
import { YoutubeVideoType } from './Types';

export const cleanArray = (deleteValue: string | number | undefined | any, array: (string | number | undefined | any)[]) => array.filter(element => element !== deleteValue);
export const sentencecase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
export const titlecase = (str: string) => str.toLowerCase().replace(/(^[a-z]| [a-z]|-[a-z])/g, word => word.toUpperCase());

export const countCaps = (stringToCheck: string, allowedLength: string): number => (stringToCheck.replace(/[^A-Z]/g, '').length / allowedLength.length) * 100;
export const countEmojis = (str: string) => {
    const customEmojis = /<a?:[\S]+:[0-9]{18}>/gim;
    const customMatch = str.match(customEmojis);
    const unicodeEmojis = emojiRegex();
    const unicodeMatch = str.match(unicodeEmojis);
    let counter = 0;

    if (unicodeMatch) counter += unicodeMatch.length;
    if (customMatch) counter += customMatch.length;

    return counter;
};
export const countMentions = (str: string) => {
    const mentions = /^<@![0-9]{18}>$/gim;
    const mentionsMatch = str.match(mentions);
    let counter = 0;

    if (mentionsMatch) counter += mentionsMatch.length;

    return counter;
};

export const deleteCommandMessages = (msg: CommandoMessage, client: CommandoClient) => {
    if (msg.deletable && client.provider.get(msg.guild, 'deletecommandmessages', false)) msg.delete();
};

export const logModMessage = (msg: CommandoMessage, guild: CommandoGuild, outChannelID: string, outChannel: TextChannel, embed: MessageEmbed) => {
    if (!guild.settings.get('hasSentModLogMessage', false)) {
        msg.reply(oneLine`
            📃 I can keep a log of moderator actions if you create a channel named \'mod-logs\'
            (or some other name configured by the ${
            guild.commandPrefix
            }setmodlogs command) and give me access to it.
            This message will only show up this one time and never again after this so if you desire to set up mod logs make sure to do so now.`);
        guild.settings.set('hasSentModLogMessage', true);
    }

    return outChannelID && guild.settings.get('modlogs', false)
        ? outChannel.send('', { embed })
        : null;
};

export const isNumberBetween = (num: number, lower: number, upper: number, inclusive: boolean) => {
    const max = Math.max(lower, upper);
    const min = Math.min(lower, upper);

    return inclusive ? num >= min && num <= max : num > min && num < max;
};

export const parseOrdinal = (num: number) => {
    const cent = num % 100;
    const dec = num % 10;

    if (cent >= 10 && cent <= 20) {
        return `${num}th`;
    }

    switch (dec) {
        case 1:
            return `${num}st`;
        case 2:
            return `${num}nd`;
        case 3:
            return `${num}rd`;
        default:
            return `${num}th`;
    }
};

export const removeDiacritics = (str: string) => {
    for (const diacritic of diacriticsMap) {
        str = str.replace(diacritic.letters, diacritic.base);
    }

    return str;
};

export const roundNumber = (num: number, scale = 0) => {
    if (!num.toString().includes('e')) {
        return Number(`${Math.round(Number(`${num}e+${scale}`))}e-${scale}`);
    }
    const arr = `${num}`.split('e');
    let sig = '';

    if (Number(arr[1]) + scale > 0) {
        sig = '+';
    }

    return Number(`${Math.round(Number(`${Number(arr[0])}e${sig}${Number(arr[1]) + scale}`))}e-${scale}`);
};

export const stopTyping = (msg: CommandoMessage) => {
    msg.channel.stopTyping(true);
};

export const startTyping = (msg: CommandoMessage) => {
    msg.channel.startTyping(1);
};

export const validateBool = (bool: boolean) => {
    if (validBooleansMap.includes(bool.toString())) return true;

    return stripIndents`
        Has to be one of ${validBooleansMap.map(val => `\`${val}\``).join(', ')}
        Respond with your new selection or`;
};

export const validateCasinoLimit = (input: string, msg: CommandoMessage) => {
    const lowerLimit = msg.guild.settings.get('casinoLowerLimit', 1);
    const upperLimit = msg.guild.settings.get('casinoUpperLimit', 10000);
    const chips = Number(input);

    if (chips >= lowerLimit && chips <= upperLimit) return true;
    return `Reply with a chips amount between ${lowerLimit} and ${upperLimit}. Example: \`${roundNumber((lowerLimit + upperLimit) / 2)}\``;
};

export const shouldHavePermission = (permission: PermissionString, shouldClientHavePermission: boolean = false) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalFunction = descriptor.value;

        descriptor.value = async function (msg: CommandoMessage, args: object, fromPattern: boolean, res?: ArgumentCollectorResult) {
            const authorIsOwner = msg.client.isOwner(msg.author);
            const memberHasPermission = msg.member.hasPermission(permission);

            if (!memberHasPermission && !authorIsOwner) {
                return msg.command.onBlock(msg, 'permission', {
                    response: `You need the "${CommandoUtil.permissions[permission]}" permission to use the ${msg.command.name} command`,
                });
            }

            if (shouldClientHavePermission) {
                const clientHasPermission = (msg.channel as TextChannel).permissionsFor(msg.client.user!)!.has(permission);

                if (!clientHasPermission && !authorIsOwner) {
                    return msg.command.onBlock(msg, 'clientPermissions', { missing: [permission] });
                }
            }

            const bindedOriginalFunction = originalFunction.bind(this); // tslint:disable-line:no-invalid-this
            const result = bindedOriginalFunction(msg, args, fromPattern, res);
            return result;
        };

        return descriptor;
    };
};

export class Song {
    public name: string;
    public id: any;
    public length: any;
    public member: GuildMember;
    public dispatcher: StreamDispatcher | null;
    public playing: boolean;

    constructor (video: YoutubeVideoType, member: GuildMember) {
        this.name = Util.escapeMarkdown(video.title);
        this.id = video.id;
        this.length = video.durationSeconds;
        this.member = member;
        this.dispatcher = null;
        this.playing = false;
    }

    get url () {
        return `https://www.youtube.com/watch?v=${this.id}`;
    }

    get thumbnail () {
        return `https://img.youtube.com/vi/${this.id}/mqdefault.jpg`;
    }

    get username () {
        return Util.escapeMarkdown(`${this.member.user.tag} (${this.member.user.id})`);
    }

    get avatar () {
        return `${this.member.user.displayAvatarURL({ format: 'png' })}`;
    }

    get lengthString () {
        return Song.timeString(this.length);
    }

    public static timeString (seconds: number, forceHours = false) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        return oneLineTrim`
			${forceHours || hours >= 1 ? `${hours}:` : ''}
			${hours >= 1 ? `0${minutes}`.slice(-2) : minutes}:
			${`0${Math.floor(seconds % 60)}`.slice(-2)}
		`;
    }

    public timeLeft (currentTime: number) {
        return Song.timeString(this.length - currentTime);
    }

    public toString () {
        return `${this.name} (${this.lengthString})`;
    }
}
