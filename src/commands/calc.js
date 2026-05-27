import { EmbedBuilder, MessageFlags } from 'discord.js';

function evaluateMath(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const char = expr[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (/\d/.test(char) || char === '.') {
      let numStr = '';
      while (i < expr.length && (/[0-9.]/.test(expr[i]))) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }
    if ('+-*/%^()'.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }
    throw new Error('Invalid character');
  }

  let tokenIndex = 0;
  function peek() {
    return tokens[tokenIndex];
  }
  function get() {
    return tokens[tokenIndex++];
  }

  function parseExpression() {
    let node = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = get().value;
      const right = parseTerm();
      node = { type: 'BINARY', op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parsePower();
    while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = get().value;
      const right = parsePower();
      node = { type: 'BINARY', op, left: node, right };
    }
    return node;
  }

  function parsePower() {
    let node = parseFactor();
    if (peek() && peek().value === '^') {
      get();
      const right = parsePower();
      node = { type: 'BINARY', op: '^', left: node, right };
    }
    return node;
  }

  function parseFactor() {
    const token = get();
    if (!token) throw new Error('Unexpected end of expression');
    if (token.type === 'NUMBER') {
      return { type: 'LITERAL', value: token.value };
    }
    if (token.value === '(') {
      const node = parseExpression();
      const next = get();
      if (!next || next.value !== ')') throw new Error('Expected ")"');
      return node;
    }
    if (token.value === '-') {
      return { type: 'UNARY', op: '-', expr: parseFactor() };
    }
    if (token.value === '+') {
      return parseFactor();
    }
    throw new Error('Unexpected token');
  }

  const ast = parseExpression();
  if (tokenIndex < tokens.length) {
    throw new Error('Unexpected trailing tokens');
  }

  function evalNode(node) {
    if (node.type === 'LITERAL') return node.value;
    if (node.type === 'UNARY') {
      if (node.op === '-') return -evalNode(node.expr);
    }
    if (node.type === 'BINARY') {
      const left = evalNode(node.left);
      const right = evalNode(node.right);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        case '%': return left % right;
        case '^': return Math.pow(left, right);
      }
    }
    throw new Error('Unknown node type');
  }

  return evalNode(ast);
}

export default {
  async execute(interaction) {
    const expression = interaction.options.getString('expression');

    // Pre-sanitize multiplication and division characters
    const sanitized = expression
      .replace(/x/gi, '*')
      .replace(/×/g, '*')
      .replace(/÷/g, '/');

    let result;
    try {
      result = evaluateMath(sanitized);
    } catch (err) {
      return interaction.reply({ content: `Error: ${err.message}`, flags: MessageFlags.Ephemeral });
    }

    if (typeof result !== 'number' || !isFinite(result)) {
      return interaction.reply({ content: 'Result is not a valid number.', flags: MessageFlags.Ephemeral });
    }

    const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🧮 Calculator')
      .setDescription(`\`\`\`\n${expression} = ${formatted}\n\`\`\``)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
