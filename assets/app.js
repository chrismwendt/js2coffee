;(function () {

window.App = {};
var view;

ready(function () {
  App.view = view = new Editors();
  view.update();
});

/*
 * manages codemirror editors
 */

function Editors () {
  this.init();
}

Editors.prototype = {
  /*
   * default text for the editors
   */

  defaultText: [
    '/*',
    ' * Welcome to the new js2coffee, now',
    ' * rewritten to use esprima, currently',
    ' * in development.',
    ' */',
    'function listen (el, event, handler) {',
    '  if (el.addEventListener) {',
    '    return el.addEventListener(event, handler);',
    '  } else {',
    '    return el.attachEvent("on" + event, function() {',
    '      return handler.call(el);',
    '    });',
    '  }',
    '}'
  ].join("\n"),

  /*
   * constructor
   */

  init: function () {
    this.$left    = q('.code-box.left');
    this.$right   = q('.code-box.right');
    this.$popup   = q('.code-box-popup');
    this.$popupIn = q('.code-box-popup > .container');
    this.editor   = this.initEditor();
    this.preview  = this.initPreview();
    this.popup    = this.initPopup();
    this.warnings = undefined;
    this.error    = undefined;
  },

  /*
   * initializes the CodeMirror instance for the JS editor
   */

  initEditor: function () {
    var editor = CodeMirror(this.$left, {
      value: this.defaultText,
      theme: 'ambiance',
      mode: 'javascript',
      tabSize: 2,
      gutters: ["CodeMirror-lint-markers"],
      lint: true,
      autofocus: true
    });

    editor.on('changes', this.update.bind(this));
    editor.on('focus', setFocus(this.$left));
    editor.on('blur',  unsetFocus(this.$left));

    return editor;
  },

  /*
   * initializes the CodeMirror instance for the Coffee preview
   */

  initPreview: function () {
    var preview = CodeMirror(this.$right, {
      theme: 'ambiance',
      mode: 'coffeescript',
      gutters: ["CodeMirror-lint-markers"],
      lint: true,
      tabSize: 2
    });
    var focused;

    preview.on('focus', setFocus(this.$right));
    preview.on('blur',  unsetFocus(this.$right));
    preview.on('blur',  function () { focused = false; });
    preview.on('focus', function () {
      focused = true;
      this.openPopup();
      this.updateReverse();
    }.bind(this));
    preview.on('changes', function () {
      if (!focused) return;
      this.openPopup();
      this.updateReverse();
    }.bind(this));

    return preview;
  },

  initPopup: function () {
    on(this.$popup.querySelector('.close-button'), 'click',
      this.closePopup.bind(this));

    var popup = CodeMirror(this.$popupIn, {
      theme: 'ambiance',
      mode: 'javascript',
      tabSize: 2
    });

    popup.on('focus', setFocus(this.$popup));
    popup.on('blur',  unsetFocus(this.$popup));

    return popup;
  },

  openPopup: function () {
    removeClass(this.$popup, 'hide');
    removeClass(this.$right, 'error');
  },

  closePopup: function () {
    addClass(this.$popup, 'hide');
    this.update();
    this.editor.focus();
  },

  /*
   * compiles the editor value
   */

  update: function () {
    var input = this.editor.getValue();
    var result = this.compile(input);
    this.warnings = result.warnings;
    this.error = result.error;

    if (!result.error) {
      this.preview.setValue(result.code);
      removeClass(this.$right, 'error');
    } else {
      addClass(this.$right, 'error');
    }
  },

  /*
   * compiles coffee to js into the popup pane
   */

  updateReverse: function () {
    var input = this.preview.getValue();
    var result = this.compileReverse(input);
    this.reverseError = result.error;

    if (!result.error) {
      this.popup.setValue(result.code);
      removeClass(this.$popup, 'error');
    } else {
      addClass(this.$popup, 'error');
    }
  },

  /*
   * compiles code from js to coffee.
   * returns the code (output js), error (Error object, if any), and output 
   * of js2coffee() (used later for warnings).
   */

  compile: function (input) {
    var output, error, code;

    try {
      output = Js2coffee.build(input);
      code = output.code;
      code += "\n# ---\n# generated by js2coffee-redux " +
        Js2coffee.version;
    } catch (err) {
      error = err;
      if (!err.start) throw err;
    }

    return {
      code: code,
      error: error,
      warnings: output && output.warnings };
  },

  /*
   * compiles coffee to js code.
   * returns output similar to `compile`
   */

  compileReverse: function (input) {
    var output, error, code;

    try {
      code = CoffeeScript.compile(input, { bare: true });
      code += "\n// ---\n// generated by coffee-script " +
        CoffeeScript.VERSION;
      code = code.trim();
    } catch (err) {
      if (!err.location) throw err;

      // Convert to js2coffee-style errors
      err.description = err.message;
      err.start = {
        line: err.location.first_line + 1,
        column: err.location.first_column
      };
      if (err.location.last_line) {
        err.end = {
          line: err.location.last_line + 1,
          column: err.location.last_column + 1
        };
      }
      console.error(err);

      error = err;
    }

    return {
      code: code,
      error: error };
  },
};

/*
 * helpers for focus handlers
 */

function setFocus ($el) {
  return function () { addClass($el, 'focus'); };
}

function unsetFocus ($el) {
  return function () { removeClass($el, 'focus'); };
}

/*
 * register a linter for JavaScript that will fetch js2c errors
 */

CodeMirror.registerHelper("lint", "javascript",
  function (text, options) {
    if (!view) return [];
    return makeCmMessages(view.warnings, view.error);
  });

CodeMirror.registerHelper("lint", "coffeescript",
  function (text, options) {
    if (!view) return [];
    return makeCmMessages([], view.reverseError);
  });

/*
 * converts js2coffee errors into codemirror messages.
 * takes in `warnings` (from return value of js2coffee()) and `error`
 * (whatever error it threw). returns an array.
 */

function makeCmMessages (warnings, error) {
  return getErrors().concat(getWarnings());

  function getErrors() {
    if (!error) return [];

    var pos = getPosition(error);
    return [{
      from: pos.from, to: pos.to, severity: 'error',
      message: error.description
    }];
  }

  function getPosition (error) {
    var from, to;
    from = CodeMirror.Pos(error.start.line-1, error.start.column);

    if (error.end)
      to = CodeMirror.Pos(error.end.line-1, error.end.column);
    else
      to = CodeMirror.Pos(error.start.line-1, error.start.column + 90);

    return { from: from, to: to };
  }

  function getWarnings() {
    if (!warnings || warnings.length === 0)
      return [];

    return warnings.map(function (warn) {
      var pos = getPosition(warn);
      return {
        from: pos.from, to: pos.to,
        severity: 'warning',
        message: warn.description
      };
    });
  }
}

/*
 * Helpers taken from npmjs.com/dom101
 */

function ready (fn) {
  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    document.attachEvent('onreadystatechange', function() {
      if (document.readyState === 'interactive') fn();
    });
  }
}

function q (query) {
  return document.querySelector(query);
}

function qa (query) {
  return document.querySelectorAll(query);
}

function on (el, event, handler) {
  if (el.addEventListener) {
    el.addEventListener(event, handler);
  } else {
    el.attachEvent('on' + event, function(){
      handler.call(el);
    });
  }
}

function removeClass (el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else {
    var expr =
      new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi');

    el.className = el.className.replace(expr, ' ');
  }
}

function addClass (el, className) {
  if (el.classList)
    el.classList.add(className);
  else
    el.className += ' ' + className;
}

})();
