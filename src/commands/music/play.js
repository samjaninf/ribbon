/*
 *   This file is part of Ribbon
 *   Copyright (C) 2017-2018 Favna
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, version 3 of the License
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *   Additional Terms 7.b and 7.c of GPLv3 apply to this file:
 *       * Requiring preservation of specified reasonable legal notices or
 *         author attributions in that material or in the Appropriate Legal
 *         Notices displayed by works containing it.
 *       * Prohibiting misrepresentation of the origin of that material,
 *         or requiring that modified versions of such material be marked in
 *         reasonable ways as different from the original version.
 */

const Discord = require('discord.js'),
	Path = require('path'),
	Song = require(Path.join(__dirname, 'data/SongStructure.js')),
	YouTube = require('simple-youtube-api'),
	commando = require('discord.js-commando'),
	{
		oneLine,
		stripIndents
	} = require('common-tags'),
	vibrant = require('node-vibrant'),
	winston = require('winston'),
	ytdl = require('ytdl-core');

const DEFAULT_VOLUME = require(Path.join(__dirname, 'data/GlobalData.js')).DEFAULT_VOLUME, // eslint-disable-line one-var
	GOOGLE_API = require(Path.join(__dirname, 'data/GlobalData.js')).GOOGLE_API,
	PASSES = require(Path.join(__dirname, 'data/GlobalData.js')).PASSES;

module.exports = class PlaySongCommand extends commando.Command {
	constructor (client) {
		super(client, {
			'name': 'play',
			'aliases': ['add', 'enqueue', 'start', 'join'],
			'group': 'music',
			'memberName': 'play',
			'description': 'Adds a song to the queue',
			'examples': ['play {youtube video to play}'],
			'guildOnly': true,
			'throttling': {
				'usages': 2,
				'duration': 3
			},

			'args': [
				{
					'key': 'url',
					'prompt': 'what music would you like to listen to?\n',
					'type': 'string'
				}
			]
		});

		this.queue = new Map();
		this.youtube = new YouTube(GOOGLE_API);
		this.embedColor = '#3498DB';
	}

	deleteCommandMessages (msg) {
		if (msg.deletable && this.client.provider.get(msg.guild, 'deletecommandmessages', false)) {
			msg.delete();
		}
	}

	async fetchColor (img) {

		const palette = await vibrant.from(img).getPalette();

		if (palette) {
			const pops = [],
				swatches = Object.values(palette);

			let prominentSwatch = {};

			for (const swatch in swatches) {
				if (swatches[swatch]) {
					pops.push(swatches[swatch]._population); // eslint-disable-line no-underscore-dangle
				}
			}

			const highestPop = pops.reduce((a, b) => Math.max(a, b)); // eslint-disable-line one-var

			for (const swatch in swatches) {
				if (swatches[swatch]) {
					if (swatches[swatch]._population === highestPop) { // eslint-disable-line no-underscore-dangle
						prominentSwatch = swatches[swatch];
						break;
					}
				}
			}
			this.embedColor = prominentSwatch.getHex();
		}

		return this.embedColor;
	}

	async run (msg, args) {
		const url = args.url.replace(/<(.+)>/g, '$1'),
			queue = this.queue.get(msg.guild.id); // eslint-disable-line sort-vars

		let voiceChannel; // eslint-disable-line init-declarations

		if (!queue) {
			voiceChannel = msg.member.voiceChannel; // eslint-disable-line
			if (!voiceChannel) {
				this.deleteCommandMessages(msg);

				return msg.reply('Please join a voice channel before issueing this command.');
			}

			const permissions = voiceChannel.permissionsFor(msg.client.user);

			if (!permissions.has('CONNECT')) {
				this.deleteCommandMessages(msg);

				return msg.reply('I don\'t have permission to join your voice channel. Fix your server\'s permisions');
			}
			if (!permissions.has('SPEAK')) {
				this.deleteCommandMessages(msg);

				return msg.reply('I don\'t have permission to speak in your voice channel. Fix your server\'s permisions');
			}
		} else if (!queue.voiceChannel.members.has(msg.author.id)) {
			this.deleteCommandMessages(msg);

			return msg.reply('Please join a voice channel before issueing this command.');
		}

		const statusMsg = await msg.reply('obtaining video details...'); // eslint-disable-line one-var

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await this.youtube.getPlaylist(url);

			this.deleteCommandMessages(msg);

			return this.handlePlaylist(playlist, queue, voiceChannel, msg, statusMsg);
		}
		try {
			const video = await this.youtube.getVideo(url);

			this.deleteCommandMessages(msg);

			return this.handleVideo(video, queue, voiceChannel, msg, statusMsg);
		} catch (error) {
			try {
				const videos = await this.youtube.searchVideos(url, 1)
						.catch(() => statusMsg.edit(`${msg.author}, there were no search results.`)),
					video2 = await this.youtube.getVideoByID(videos[0].id); // eslint-disable-line sort-vars

				this.deleteCommandMessages(msg);

				return this.handleVideo(video2, queue, voiceChannel, msg, statusMsg);
			} catch (err) {
				winston.error(err);
				this.deleteCommandMessages(msg);

				return statusMsg.edit(`${msg.author}, couldn't obtain the search result video's details.`);
			}
		}

	}

	async handleVideo (video, queue, voiceChannel, msg, statusMsg) {
		if (video.durationSeconds === 0) {
			statusMsg.edit(`${msg.author}, you can't play live streams.`);

			return null;
		}

		if (!queue) {
			// eslint-disable-next-line no-param-reassign
			queue = {
				'textChannel': msg.channel,
				voiceChannel,
				'connection': null,
				'songs': [],
				'volume': this.client.provider.get(msg.guild.id, 'defaultVolume', DEFAULT_VOLUME)
			};
			this.queue.set(msg.guild.id, queue);

			const result = await this.addSong(msg, video),
				resultMessage = {
					'color': 3447003,
					'author': {
						'name': `${msg.author.tag} (${msg.author.id})`,
						'icon_url': msg.author.displayAvatarURL({'format': 'png'}) // eslint-disable-line camelcase
					},
					'description': result
				};

			if (!result.startsWith('👍')) {
				this.queue.delete(msg.guild.id);
				statusMsg.edit('', {'embed': resultMessage});

				return null;
			}

			statusMsg.edit(`${msg.author}, joining your voice channel...`);
			try {
				const connection = await queue.voiceChannel.join();

				queue.connection = connection;
				this.play(msg.guild, queue.songs[0]);
				statusMsg.delete();

				return null;
			} catch (error) {
				winston.error('Error occurred when joining voice channel.', error);
				this.queue.delete(msg.guild.id);
				statusMsg.edit(`${msg.author}, unable to join your voice channel.`);

				return null;
			}
		} else {
			const result = await this.addSong(msg, video),
				resultMessage = {
					'color': 3447003,
					'author': {
						'name': `${msg.author.tag} (${msg.author.id})`,
						'icon_url': msg.author.displayAvatarURL({'format': 'png'}) // eslint-disable-line camelcase
					},
					'description': result
				};

			statusMsg.edit('', {'embed': resultMessage});

			return null;
		}
	}

	async handlePlaylist (playlist, queue, voiceChannel, msg, statusMsg) {
		const videos = await playlist.getVideos();

		for (const video of Object.values(videos)) {
			const video2 = await this.youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop

			if (video2.durationSeconds === 0) {
				statusMsg.edit(`${msg.author}, you can't play live streams.`);

				return null;
			}

			if (!queue) {
				// eslint-disable-next-line no-param-reassign
				queue = {
					'textChannel': msg.channel,
					voiceChannel,
					'connection': null,
					'songs': [],
					'volume': this.client.provider.get(msg.guild.id, 'defaultVolume', DEFAULT_VOLUME)
				};
				this.queue.set(msg.guild.id, queue);

				const result = await this.addSong(msg, video2); // eslint-disable-line no-await-in-loop

				if (!result.startsWith('👍')) {
					this.queue.delete(msg.guild.id);
				}

				statusMsg.edit(`${msg.author}, joining your voice channel...`);
				try {
					const connection = await queue.voiceChannel.join(); // eslint-disable-line no-await-in-loop

					queue.connection = connection;
					this.play(msg.guild, queue.songs[0]);
					statusMsg.delete();
				} catch (error) {
					winston.error('Error occurred when joining voice channel.', error);
					this.queue.delete(msg.guild.id);
					statusMsg.edit(`${msg.author}, unable to join your voice channel.`);
				}
			} else {
				await this.addSong(msg, video2); // eslint-disable-line no-await-in-loop
				statusMsg.delete();
			}
		}

		queue.textChannel.send({
			'embed': {
				'color': 3447003,
				'author': {
					'name': `${msg.author.tag} (${msg.author.id})`,
					'icon_url': msg.author.displayAvatarURL({'format': 'png'}) // eslint-disable-line camelcase
				},
				'description': stripIndents `
                        Playlist: [${playlist.title}](https://www.youtube.com/playlist?list=${playlist.id}) added to the queue!
    
                        Check what's been added with: \`${msg.guild.commandPrefix}queue\` or \`@Ribbon#2325 queue\`!
                    `
			}
		});

		return null;
	}

	addSong (msg, video) {
		const queue = this.queue.get(msg.guild.id),
			song = new Song(video, msg.member);

		if (!this.client.isOwner(msg.author)) {
			if (queue.songs.some(track => track.id === video.id)) {
				return `👎 ${Discord.escapeMarkdown(video.title)} is already queued.`;
			}
		}

		winston.info('Adding song to queue.', {
			'song': video.id,
			'guild': msg.guild.id
		});


		queue.songs.push(song);

		return oneLine `
                👍 ${song.url.match(/^https?:\/\/(api.soundcloud.com)\/(.*)$/) ? `${song}` : `[${song}](${`${song.url}`})`}
            `;
	}

	async play (guild, song) {
		const queue = this.queue.get(guild.id),
			vote = this.votes.get(guild.id);

		if (vote) {
			clearTimeout(vote);
			this.votes.delete(guild.id);
		}

		if (!song) {
			queue.textChannel.send('We\'ve run out of songs! Better queue up some more tunes.');
			queue.voiceChannel.leave();
			this.queue.delete(guild.id);

			return;
		}

		const embedColor = await this.fetchColor(song.thumbnail), // eslint-disable-line one-var
			songEmbed = new Discord.MessageEmbed();

		songEmbed
			.setColor(embedColor ? embedColor : this.embedColor)
			.setAuthor(song.username, song.avatar)
			.setDescription(oneLine `${song.url.match(/^https?:\/\/(api.soundcloud.com)\/(.*)$/) ? `${song}` : `[${song}](${`${song.url}`})`}`)
			.setImage(song.thumbnail);

		const playing = queue.textChannel.send({'embed': songEmbed}); // eslint-disable-line one-var
		let streamErrored = false;

		const stream = ytdl(song.url, {'audioonly': true}) // eslint-disable-line one-var
			.on('error', (err) => {
				streamErrored = true;
				winston.error('Error occurred when streaming video:', err);
				playing.then(msg => msg.edit(`❌ Couldn't play ${song}. What a drag!`));
				queue.songs.shift();
				this.play(guild, queue.songs[0]);
			});

		const dispatcher = queue.connection.playStream(stream, {'passes': PASSES}) // eslint-disable-line one-var
			.on('end', () => {
				if (streamErrored) {
					return;
				}
				queue.songs.shift();
				this.play(guild, queue.songs[0]);
			})
			.on('error', (err) => {
				winston.error('Error occurred in stream dispatcher:', err);
				queue.textChannel.send(`An error occurred while playing the song: \`${err}\``);
			});

		queue.connection.player.opusEncoder.setPLP(0.01);
		dispatcher.setVolumeLogarithmic(queue.volume / 5);
		song.dispatcher = dispatcher;
		song.playing = true;
	}

	get votes () {

		/* eslint-disable no-underscore-dangle */
		if (!this._votes) {
			this._votes = this.client.registry.resolveCommand('music:skip').votes;
		}

		return this._votes;
		/* eslint-enable no-underscore-dangle */
	}
};