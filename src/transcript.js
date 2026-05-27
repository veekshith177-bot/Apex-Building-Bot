import { AttachmentBuilder } from 'discord.js';
import db from './database.js';

const stmtTicket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
const stmtNotes = db.prepare('SELECT * FROM notes WHERE ticket_id = ? ORDER BY created_at ASC');
const stmtActions = db.prepare('SELECT * FROM ticket_actions WHERE ticket_channel_id = ? ORDER BY created_at ASC');

const ACTION_LABELS = {
  create: 'Ticket created',
  close: 'Ticket closed',
  claim: 'Ticket claimed',
  add: 'User added',
  remove: 'User removed',
  note: 'Staff note added',
  rename: 'Channel renamed',
};

const MAX_TRANSCRIPT_MESSAGES = 10000;

export async function generateTranscript(channel) {
  const messages = [];
  let lastId;
  while (messages.length < MAX_TRANSCRIPT_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (!batch.size) break;
    for (const msg of batch.values()) {
      messages.push(msg);
      if (messages.length >= MAX_TRANSCRIPT_MESSAGES) break;
    }
    lastId = batch.last().id;
  }
  messages.reverse();

  const ticket = stmtTicket.get(channel.id);
  const notes = ticket ? stmtNotes.all(ticket.id) : [];
  const actions = stmtActions.all(channel.id);

  const lines = [];
  const divider = '─'.repeat(50);

  lines.push(`Transcript — ${channel.name}`);
  lines.push(`${channel.guild?.name || 'Server'} — ${new Date().toLocaleString()}`);
  lines.push(divider);
  lines.push('');

  for (const a of actions) {
    lines.push(`[${ACTION_LABELS[a.action] || a.action}]`);
  }
  if (actions.length) lines.push('');

  for (const n of notes) {
    lines.push('[Staff Note]');
    lines.push(n.content);
    lines.push('');
  }
  if (notes.length) lines.push(divider);

  for (const m of messages) {
    const name = m.author.username;
    const content = m.content || '';

    lines.push(`${name}: ${content}`);

    if (m.attachments.size > 0) {
      for (const att of m.attachments.values()) {
        lines.push(`  [Attachment] ${att.name || 'file'} — ${att.url}`);
      }
    }

    if (m.embeds.length > 0) {
      for (const e of m.embeds) {
        if (e.title) lines.push(`  [Embed] ${e.title}`);
        if (e.description) lines.push(`  ${e.description}`);
        if (e.url) lines.push(`  ${e.url}`);
      }
    }
  }

  const text = lines.join('\n');
  return new AttachmentBuilder(Buffer.from(text), { name: `transcript-${channel.name}.txt` });
}
