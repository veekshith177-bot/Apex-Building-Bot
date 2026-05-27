import { EmbedBuilder, MessageFlags } from 'discord.js';

export default {
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 4096 }))
      .addFields(
        { name: 'ID', value: `\`${user.id}\``, inline: true },
        { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
      );

    if (member) {
      embed.addFields(
        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roles', value: `${member.roles.cache.filter(r => r.id !== interaction.guild.id).size}`, inline: true },
        { name: 'Boosting', value: member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'Not boosting', inline: true },
      );

      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position);

      if (roles.size > 0) {
        const list = roles.map(r => r.toString()).slice(0, 20);
        if (list.length < roles.size) list.push(`*+${roles.size - list.length} more*`);
        embed.addFields({ name: `Roles [${roles.size}]`, value: list.join(' '), inline: false });
      }
    }

    const banner = user.bannerURL({ size: 2048 });
    if (banner) embed.setImage(banner);

    embed.setFooter({ text: `Requested by ${interaction.user.tag}` }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
