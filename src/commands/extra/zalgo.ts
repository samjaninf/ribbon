/**
 * @file Extra ZalgoCommand - Create zalgo-fied text from your input
 *
 * First banishes any existing zalgo to ensure proper result
 *
 * **Aliases**: `trash`
 * @module
 * @category extra
 * @name zalgo
 * @example zalgo HE COMES
 * @param {string} SomeText Your input to transform with Zalgo
 */

import { deleteCommandMessages } from '@components/Utils';
import { Command, CommandoClient, CommandoMessage } from 'awesome-commando';
import zalgo, { banish } from 'awesome-zalgo';

type ZalgoArgs = {
    txt: string;
};

export default class ZalgoCommand extends Command {
    constructor (client: CommandoClient) {
        super(client, {
            name: 'zalgo',
            aliases: ['trash'],
            group: 'extra',
            memberName: 'zalgo',
            description: 'F*ck up text using Zalgo',
            format: 'ContentToTransform',
            examples: ['zalgo HE COMES'],
            guildOnly: false,
            throttling: {
                usages: 2,
                duration: 3,
            },
            args: [
                {
                    key: 'txt',
                    prompt: 'What should I zalgolize?',
                    type: 'string',
                }
            ],
        });
    }

    public run (msg: CommandoMessage, { txt }: ZalgoArgs) {
        deleteCommandMessages(msg, this.client);

        return msg.say(zalgo(banish(txt)));
    }
}
