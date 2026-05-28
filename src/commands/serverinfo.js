import { EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';
import { THEME } from '../ui/theme.js';

const VerificationLevel = { None: 0, Low: 1, Medium: 2, High: 3, VeryHigh: 4 };

const VERIFICATION_NAMES = {
  [VerificationLevel.None]: 'None',
  [VerificationLevel.Low]: 'Low',
  [VerificationLevel.Medium]: 'Medium',
  [VerificationLevel.High]: 'High',
  [VerificationLevel.VeryHigh]: 'Very High',
};

export default {
  async execute(interaction) {
    const { guild } = interaction;

    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

    const members = guild.members.cache;
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;

    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const embed = new EmbedBuilder()
      .setColor(THEME.colors.warn)
      .setAuthor({ name: THEME.brandName, iconURL: guild.iconURL({ size: 64 }) || undefined })
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 4096 }))
      .addFields(
        { name: 'ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Members', value: `**${humans}** Humans\n**${bots}** Bots\n• **${members.size}** Total`, inline: true },
        { name: 'Channels', value: `**${textChannels}** Text\n**${voiceChannels}** Voice\n**${categories}** Categories`, inline: true },
        { name: 'Boosts', value: `Level **${boostLevel}**\n**${boostCount}** Boost${boostCount !== 1 ? 's' : ''}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: 'Verification', value: VERIFICATION_NAMES[guild.verificationLevel] || 'Unknown', inline: true },
      );

    const banner = guild.bannerURL({ size: 2048 });
    if (banner) embed.setImage(banner);

    embed.setFooter({ text: `${THEME.brandName} • Requested by ${interaction.user.tag}` }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
