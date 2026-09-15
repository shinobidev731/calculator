/**
 * ============================================================================
 * PHYSICAL SCIENTIFIC CALCULATOR ENGINE
 * Clean, modular, and safe math parser with complete UI & keyboard integration.
 * ============================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 1. DOM Elements
  // --------------------------------------------------------------------------
  const mainDisplay = document.getElementById('main-display');
  const expressionDisplay = document.getElementById('expression-display');
  const modeToggle = document.getElementById('mode-toggle');
  const keypad = document.querySelector('.keypad');

  // --------------------------------------------------------------------------
  // 2. Application State
  // --------------------------------------------------------------------------
  let expression = '';
  let angleMode = 'DEG'; // 'DEG' or 'RAD'
  let isResultDisplayed = false;

  // --------------------------------------------------------------------------
  // 3. Mathematical Parser & Evaluator (Safe, No eval())
  // --------------------------------------------------------------------------

  /**
   * Computes trigonometric values with exact degree presets
   */
  function computeTrig(func, arg, mode) {
    let radians = arg;

    if (mode === 'DEG') {
      const normalizedDeg = ((arg % 360) + 360) % 360;

      // Handle common clean angles in degree mode
      if (func === 'sin') {
        if (normalizedDeg === 0 || normalizedDeg === 180) return 0;
        if (normalizedDeg === 90) return 1;
        if (normalizedDeg === 270) return -1;
        if (normalizedDeg === 30 || normalizedDeg === 150) return 0.5;
        if (normalizedDeg === 210 || normalizedDeg === 330) return -0.5;
      } else if (func === 'cos') {
        if (normalizedDeg === 0) return 1;
        if (normalizedDeg === 90 || normalizedDeg === 270) return 0;
        if (normalizedDeg === 180) return -1;
        if (normalizedDeg === 60 || normalizedDeg === 300) return 0.5;
        if (normalizedDeg === 120 || normalizedDeg === 240) return -0.5;
      } else if (func === 'tan') {
        if (normalizedDeg === 90 || normalizedDeg === 270) {
          throw new Error('Undefined');
        }
        if (normalizedDeg === 0 || normalizedDeg === 180) return 0;
        if (normalizedDeg === 45 || normalizedDeg === 225) return 1;
        if (normalizedDeg === 135 || normalizedDeg === 315) return -1;
      }

      radians = (arg * Math.PI) / 180;
    }

    let val;
    if (func === 'sin') {
      val = Math.sin(radians);
    } else if (func === 'cos') {
      val = Math.cos(radians);
    } else if (func === 'tan') {
      if (Math.abs(Math.cos(radians)) < 1e-15) {
        throw new Error('Undefined');
      }
      val = Math.tan(radians);
    } else {
      throw new Error('Unknown function');
    }

    // Strip tiny floating-point residuals near zero
    if (Math.abs(val) < 1e-12) return 0;
    return val;
  }

  /**
   * Tokenizes an arithmetic expression into structured tokens
   */
  function tokenize(str) {
    const tokens = [];
    let i = 0;

    while (i < str.length) {
      const ch = str[i];

      // Ignore whitespace
      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }

      // Operators & Parentheses
      if (['+', '-', '*', '/'].includes(ch)) {
        tokens.push({ type: 'OP', value: ch });
        i++;
      } else if (ch === '%') {
        tokens.push({ type: 'PERCENT', value: '%' });
        i++;
      } else if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
      } else if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
      } else if (str.slice(i, i + 3) === 'sin') {
        tokens.push({ type: 'FUNC', value: 'sin' });
        i += 3;
      } else if (str.slice(i, i + 3) === 'cos') {
        tokens.push({ type: 'FUNC', value: 'cos' });
        i += 3;
      } else if (str.slice(i, i + 3) === 'tan') {
        tokens.push({ type: 'FUNC', value: 'tan' });
        i += 3;
      } else if ((ch >= '0' && ch <= '9') || ch === '.') {
        let numStr = '';
        while (i < str.length && ((str[i] >= '0' && str[i] <= '9') || str[i] === '.')) {
          numStr += str[i];
          i++;
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      } else {
        throw new Error('Invalid syntax');
      }
    }

    return tokens;
  }

  /**
   * Recursive descent parser handling operator precedence (+, -)
   */
  function parseExpression(tokens, pos, mode) {
    let [left, nextPos] = parseTerm(tokens, pos, mode);

    while (
      nextPos < tokens.length &&
      tokens[nextPos].type === 'OP' &&
      (tokens[nextPos].value === '+' || tokens[nextPos].value === '-')
    ) {
      const op = tokens[nextPos].value;
      const [right, afterRight] = parseTerm(tokens, nextPos + 1, mode);

      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
      nextPos = afterRight;
    }

    return [left, nextPos];
  }

  /**
   * Recursive descent parser handling higher precedence (*, /)
   */
  function parseTerm(tokens, pos, mode) {
    let [left, nextPos] = parseFactor(tokens, pos, mode);

    while (
      nextPos < tokens.length &&
      tokens[nextPos].type === 'OP' &&
      (tokens[nextPos].value === '*' || tokens[nextPos].value === '/')
    ) {
      const op = tokens[nextPos].value;
      const [right, afterRight] = parseFactor(tokens, nextPos + 1, mode);

      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) {
          throw new Error('Cannot divide by 0');
        }
        left = left / right;
      }
      nextPos = afterRight;
    }

    return [left, nextPos];
  }

  /**
   * Factors: unary sign (+ / -), percentage, and primary tokens
   */
  function parseFactor(tokens, pos, mode) {
    if (pos >= tokens.length) throw new Error('Incomplete expression');

    let sign = 1;
    while (
      pos < tokens.length &&
      tokens[pos].type === 'OP' &&
      (tokens[pos].value === '+' || tokens[pos].value === '-')
    ) {
      if (tokens[pos].value === '-') sign = -sign;
      pos++;
    }

    let [val, nextPos] = parsePrimary(tokens, pos, mode);
    val = val * sign;

    // Postfix percentage: e.g. 50% = 0.5
    while (nextPos < tokens.length && tokens[nextPos].type === 'PERCENT') {
      val = val / 100;
      nextPos++;
    }

    return [val, nextPos];
  }

  /**
   * Primary: Numbers, Parentheses, Functions
   */
  function parsePrimary(tokens, pos, mode) {
    if (pos >= tokens.length) throw new Error('Incomplete expression');
    const token = tokens[pos];

    if (token.type === 'NUMBER') {
      return [token.value, pos + 1];
    }

    if (token.type === 'LPAREN') {
      const [val, nextPos] = parseExpression(tokens, pos + 1, mode);
      if (nextPos < tokens.length && tokens[nextPos].type === 'RPAREN') {
        return [val, nextPos + 1];
      }
      return [val, nextPos]; // Auto-close unclosed parenthesis
    }

    if (token.type === 'FUNC') {
      const funcName = token.value;
      let nextPos = pos + 1;
      let arg = 0;

      if (nextPos < tokens.length && tokens[nextPos].type === 'LPAREN') {
        const [val, afterExpr] = parseExpression(tokens, nextPos + 1, mode);
        arg = val;
        nextPos = afterExpr;
        if (nextPos < tokens.length && tokens[nextPos].type === 'RPAREN') {
          nextPos++;
        }
      } else {
        const [val, afterFactor] = parseFactor(tokens, nextPos, mode);
        arg = val;
        nextPos = afterFactor;
      }

      const res = computeTrig(funcName, arg, mode);
      return [res, nextPos];
    }

    throw new Error('Invalid syntax');
  }

  /**
   * Evaluates complete string expression
   */
  function evaluateExpression(expr, mode) {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;

    const [result, pos] = parseExpression(tokens, 0, mode);
    if (pos < tokens.length) throw new Error('Invalid expression');
    return result;
  }

  /**
   * Formats numeric output cleanly without IEEE 754 float drift
   */
  function formatResult(val) {
    if (typeof val !== 'number' || isNaN(val)) return 'Error';
    if (!isFinite(val)) return 'Cannot divide by 0';

    const rounded = parseFloat(val.toPrecision(12));

    // Scientific notation for very large or tiny numbers
    if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      return rounded.toExponential(6).replace(/\.?0+e/, 'e');
    }

    return rounded.toString();
  }

  // --------------------------------------------------------------------------
  // 4. UI & Display Formatting
  // --------------------------------------------------------------------------

  function formatDisplayFormula(str) {
    return str
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\+/g, ' + ')
      .replace(/(?<=\d|\))\s*-\s*/g, ' − ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function updateDisplayFont() {
    const len = mainDisplay.value.length;
    if (len > 14) {
      mainDisplay.style.fontSize = '1.4rem';
    } else if (len > 9) {
      mainDisplay.style.fontSize = '1.75rem';
    } else {
      mainDisplay.style.fontSize = '2.2rem';
    }
  }

  function setMainDisplay(val) {
    mainDisplay.value = val;
    updateDisplayFont();
  }

  // --------------------------------------------------------------------------
  // 5. User Actions
  // --------------------------------------------------------------------------

  function inputDigit(digit) {
    if (isResultDisplayed) {
      expression = digit;
      isResultDisplayed = false;
    } else {
      if (expression === '0') {
        expression = digit;
      } else {
        expression += digit;
      }
    }
    setMainDisplay(expression);
  }

  function inputDecimal() {
    if (isResultDisplayed) {
      expression = '0.';
      isResultDisplayed = false;
      setMainDisplay(expression);
      return;
    }

    const segments = expression.split(/[\+\-\*\/\(\)\s]/);
    const lastSegment = segments[segments.length - 1];

    if (lastSegment.includes('.')) return; // Prevent multiple dots in one number

    if (lastSegment === '' || expression.endsWith('(')) {
      expression += '0.';
    } else {
      expression += '.';
    }
    setMainDisplay(expression);
  }

  function inputOperator(op) {
    if (isResultDisplayed) {
      if (['Error', 'Cannot divide by 0', 'Undefined'].includes(mainDisplay.value)) {
        expression = '0 ' + op + ' ';
      } else {
        expression = mainDisplay.value + ' ' + op + ' ';
      }
      isResultDisplayed = false;
      setMainDisplay(expression);
      return;
    }

    if (expression === '') {
      if (op === '-') {
        expression = '-';
        setMainDisplay(expression);
      }
      return;
    }

    const trimmed = expression.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];

    if (['+', '-', '*', '/'].includes(lastChar)) {
      if (lastChar === '-' && trimmed.length > 1 && ['+', '*', '/'].includes(trimmed[trimmed.length - 2])) {
        expression = trimmed.slice(0, -2).trimEnd() + ' ' + op + ' ';
      } else if (op === '-' && ['+', '*', '/'].includes(lastChar)) {
        expression = trimmed + ' -';
      } else {
        expression = trimmed.slice(0, -1).trimEnd() + ' ' + op + ' ';
      }
    } else if (lastChar === '(') {
      if (op === '-') {
        expression += '-';
      }
    } else {
      expression = trimmed + ' ' + op + ' ';
    }

    setMainDisplay(expression);
  }

  function inputFunction(func) {
    if (isResultDisplayed) {
      expression = '';
      isResultDisplayed = false;
    }

    const trimmed = expression.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];

    if (lastChar && /[0-9\)]/.test(lastChar)) {
      expression = trimmed + ' * ' + func + '(';
    } else {
      expression = trimmed + (trimmed.length > 0 && !trimmed.endsWith('(') ? ' ' : '') + func + '(';
    }

    setMainDisplay(expression);
  }

  function inputParenthesis(paren) {
    if (isResultDisplayed) {
      expression = '';
      isResultDisplayed = false;
    }

    const trimmed = expression.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];

    if (paren === '(') {
      if (lastChar && /[0-9\)]/.test(lastChar)) {
        expression = trimmed + ' * (';
      } else {
        expression += '(';
      }
    } else if (paren === ')') {
      const openCount = (expression.match(/\(/g) || []).length;
      const closeCount = (expression.match(/\)/g) || []).length;
      if (openCount > closeCount && lastChar && !['+', '-', '*', '/', '('].includes(lastChar)) {
        expression += ')';
      }
    }

    setMainDisplay(expression || '0');
  }

  function deleteLast() {
    if (isResultDisplayed) {
      clearAll();
      return;
    }

    let trimmed = expression.trimEnd();
    if (trimmed.length === 0) {
      setMainDisplay('0');
      return;
    }

    if (trimmed.endsWith('sin(') || trimmed.endsWith('cos(') || trimmed.endsWith('tan(')) {
      expression = trimmed.slice(0, -4);
    } else {
      expression = trimmed.slice(0, -1);
    }

    expression = expression.trimEnd();
    setMainDisplay(expression.length > 0 ? expression : '0');
  }

  function clearAll() {
    expression = '';
    isResultDisplayed = false;
    expressionDisplay.innerHTML = '&nbsp;';
    setMainDisplay('0');
  }

  function calculateResult() {
    if (!expression || expression.trim() === '') return;

    let evalExpr = expression.trim();

    // Auto-close dangling parentheses
    const openCount = (evalExpr.match(/\(/g) || []).length;
    const closeCount = (evalExpr.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      evalExpr += ')'.repeat(openCount - closeCount);
    }

    expressionDisplay.textContent = formatDisplayFormula(evalExpr) + ' =';

    try {
      const result = evaluateExpression(evalExpr, angleMode);
      const formatted = formatResult(result);
      setMainDisplay(formatted);
      expression = formatted;
      isResultDisplayed = true;
    } catch (err) {
      setMainDisplay(err.message || 'Error');
      isResultDisplayed = true;
    }
  }

  function toggleAngleMode() {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    modeToggle.textContent = angleMode;
    modeToggle.setAttribute(
      'aria-label',
      `Angle mode: ${angleMode === 'DEG' ? 'Degrees' : 'Radians'}. Click to toggle.`
    );
  }

  // --------------------------------------------------------------------------
  // 6. Event Handlers: Keypad & Keyboard
  // --------------------------------------------------------------------------

  function flashButton(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('btn-active');
      setTimeout(() => btn.classList.remove('btn-active'), 120);
    }
  }

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.num !== undefined) {
      inputDigit(btn.dataset.num);
    } else if (btn.dataset.op !== undefined) {
      inputOperator(btn.dataset.op);
    } else if (btn.dataset.func !== undefined) {
      inputFunction(btn.dataset.func);
    } else if (btn.dataset.insert !== undefined) {
      const val = btn.dataset.insert;
      if (val === '.') inputDecimal();
      else if (val === '(' || val === ')') inputParenthesis(val);
    } else if (btn.dataset.action !== undefined) {
      const action = btn.dataset.action;
      if (action === 'clear') clearAll();
      else if (action === 'delete') deleteLast();
      else if (action === 'equals') calculateResult();
    }
  });

  modeToggle.addEventListener('click', toggleAngleMode);

  window.addEventListener('keydown', (e) => {
    if (['/', '*', '+', '-', 'Enter', 'Backspace', 'Escape'].includes(e.key)) {
      e.preventDefault();
    }

    const key = e.key;

    if (key >= '0' && key <= '9') {
      inputDigit(key);
      flashButton(`[data-num="${key}"]`);
    } else if (key === '.') {
      inputDecimal();
      flashButton(`[data-insert="."]`);
    } else if (['+', '-', '*', '/'].includes(key)) {
      inputOperator(key);
      flashButton(`[data-op="${key}"]`);
    } else if (key === '%') {
      inputOperator('%');
      flashButton(`[data-op="%"]`);
    } else if (key === '(' || key === ')') {
      inputParenthesis(key);
      flashButton(`[data-insert="${key}"]`);
    } else if (key === 'Enter' || key === '=') {
      calculateResult();
      flashButton(`[data-action="equals"]`);
    } else if (key === 'Backspace') {
      deleteLast();
      flashButton(`[data-action="delete"]`);
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      clearAll();
      flashButton(`[data-action="clear"]`);
    } else if (key.toLowerCase() === 's') {
      inputFunction('sin');
      flashButton(`[data-func="sin"]`);
    } else if (key.toLowerCase() === 'o') {
      inputFunction('cos');
      flashButton(`[data-func="cos"]`);
    } else if (key.toLowerCase() === 't') {
      inputFunction('tan');
      flashButton(`[data-func="tan"]`);
    } else if (key.toLowerCase() === 'd') {
      toggleAngleMode();
      flashButton('#mode-toggle');
    }
  });

});