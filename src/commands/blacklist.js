import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';
import { THEME } from '../ui/theme.js';

const stmtUpsertBlacklist = db.prepare('INSERT OR REPLACE INTO blacklist (user_id, reason, added_by) VALUES (?, ?, ?)');
const stmtDeleteBlacklist = db.prepare('DELETE FROM blacklist WHERE user_id = ?');
const stmtListBlacklist = db.prepare('SELECT * FROM blacklist ORDER BY added_at DESC');

function getRoleId() {
  return process.env.BLACKLIST_ROLE_ID;
}

async function assignRole(interaction, userId) {
  const roleId = getRoleId();
  if (!roleId) return;
  try {
    const member = await interaction.guild.members.fetch(userId);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId);
    }
  } catch {}
}

async function removeRole(interaction, userId) {
  const roleId = getRoleId();
  if (!roleId) return;
  try {
    const member = await interaction.guild.members.fetch(userId);
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
    }
  } catch {}
}

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      stmtUpsertBlacklist.run(user.id, reason, interaction.member.id);
      await assignRole(interaction, user.id);
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('User Blacklisted')
        .setDescription(`${user.tag} has been blacklisted from tickets and giveaways.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      stmtDeleteBlacklist.run(user.id);
      await removeRole(interaction, user.id);
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.success)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('User Unblacklisted')
        .setDescription(`${user.tag} can now create tickets and join giveaways again.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const rows = stmtListBlacklist.all();
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Blacklisted Users')
        .setTimestamp();
      if (!rows.length) {
        embed.setDescription('No blacklisted users.\nUse `/blacklist add <user>` to block someone from tickets and giveaways.');
      } else {
        embed.setDescription(rows.map(r => `<@${r.user_id}> ${r.reason ? `— ${r.reason}` : ''}`).join('\n'));
      }
      return interaction.reply({ embeds: [embed] });
    }
  },
};
