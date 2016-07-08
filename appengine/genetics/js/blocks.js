/**
 * Blockly Games: Genetics Blocks
 *
 * Copyright 2016 Google Inc.
 * https://github.com/google/blockly-games
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Blocks for Blockly's Genetics application.
 * @author kozbial@google.com (Monica Kozbial)
 */
'use strict';

goog.provide('Genetics.Blocks');

goog.require('Blockly');
goog.require('Blockly.JavaScript');
goog.require('BlocklyGames');
goog.require('BlocklyGames.JSBlocks');

/**
 * Common HSV hue for all pond blocks.
 */
Genetics.Blocks.GENETICS_MOUSEFUNCTIONS_HUE = 360; // TODO update template to use this constant
Genetics.Blocks.GENETICS_HUE = 20;

// Extensions to Blockly's language and JavaScript generator.

Blockly.JavaScript['genetics_mouseFunction_'] = function(funcName, args, block) {
  // Define a procedure with a return value.
  var branch = Blockly.JavaScript.statementToCode(block, 'STACK');
  if (Blockly.JavaScript.STATEMENT_PREFIX) {
    branch = Blockly.JavaScript.prefixLines(
            Blockly.JavaScript.STATEMENT_PREFIX.replace(/%1/g,
                '\'' + block.id + '\''), Blockly.JavaScript.INDENT) + branch;
  }
  if (Blockly.JavaScript.INFINITE_LOOP_TRAP) {
    branch = Blockly.JavaScript.INFINITE_LOOP_TRAP.replace(/%1/g,
            '\'' + block.id + '\'') + branch;
  }
  var returnValue = Blockly.JavaScript.valueToCode(block, 'RETURN',
          Blockly.JavaScript.ORDER_NONE) || '';
  if (returnValue) {
    returnValue = '  return ' + returnValue + ';\n';
  }
  var code = 'function ' + funcName + '(' + args + ') {\n' +
      branch + returnValue + '}';
  code = Blockly.JavaScript.scrub_(block, code);
  Blockly.JavaScript.definitions_[funcName] = code;
  return null;
};

/**
 * Block for mouse function definition JSON initialization function.
 * @this Blockly.Block
 */
Blockly.Blocks['genetics_mouseFunctionInit_'] = function(funcName, args,
    returnType) {
  this.jsonInit({
    "message0": "function %1( " + args + " ) { %2 %3 return %4 }",
    "args0": [
      {
        "type": "field_label",
        "name": "NAME",
        "text": funcName
      },
      {
        "type": "input_dummy"
      },
      {
        "type": "input_statement",
        "name": "STACK"
      },
      {
        "type": "input_value",
        "check": returnType,
        "align": "right",
        "name": "RETURN"
      }
    ],
    "inputsInline": true,
    "colour": Genetics.Blocks.GENETICS_MOUSEFUNCTIONS_HUE,
    "tooltip": BlocklyGames.getMsg('Genetics_' + funcName + 'Tooltip')
  });
};

Blockly.Blocks['genetics_pickFight'] = {
  init: goog.partial(Blockly.Blocks['genetics_mouseFunctionInit_'],
                     'pickFight', '', 'Mouse')
};
Blockly.JavaScript['genetics_pickFight'] =
    goog.partial(Blockly.JavaScript['genetics_mouseFunction_'],
                 'pickFight', '');

Blockly.Blocks['genetics_chooseMate'] = {
  init: goog.partial(Blockly.Blocks['genetics_mouseFunctionInit_'],
                     'chooseMate', '', 'Mouse')
};
Blockly.JavaScript['genetics_chooseMate'] =
    goog.partial(Blockly.JavaScript['genetics_mouseFunction_'],
                 'chooseMate', '');

Blockly.Blocks['genetics_mateAnswer'] = {
  init: goog.partial(Blockly.Blocks['genetics_mouseFunctionInit_'],
                     'mateAnswer', 'suitor', 'Boolean'),
  getVars: function() {
    return ['suitor'];
  }
};
Blockly.JavaScript['genetics_mateAnswer'] =
    goog.partial(Blockly.JavaScript['genetics_mouseFunction_'],
                 'mateAnswer', 'suitor');

Blockly.Blocks['genetics_me'] = {
  /**
   * Block for getting the mouse making the decision.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": "me ()",
      "output": "Mouse",
      "colour": Genetics.Blocks.GENETICS_HUE,
      "tooltip": BlocklyGames.getMsg('Genetics_meTooltip')
    });
  }
};

Blockly.JavaScript['genetics_me'] = function(block) {
  // Generate JavaScript for mouse making the decision.
  return ['me()', Blockly.JavaScript.ORDER_FUNCTION_CALL];
};

Blockly.Blocks['genetics_getMice'] = {
  /**
   * Block for getting the mouse making the decision.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": "getMice ()",
      "output": "Array",
      "colour": Genetics.Blocks.GENETICS_HUE,
      "tooltip": BlocklyGames.getMsg('Genetics_getMiceTooltip')
    });
  }
};

Blockly.JavaScript['genetics_getMice'] = function(block) {
  // Generate JavaScript for getting mice.
  return ['getMice()', Blockly.JavaScript.ORDER_FUNCTION_CALL];
};

/**
 * Block for getting the properties of a mouse.
 * @this Blockly.Block
 */
Blockly.Blocks['genetics_getProperties'] = {
  /**
   * Block for getting mouse properties
   * @this Blockly.Block
   */
  init: function() {
    var PROPERTIES =
        [['size', 'SIZE'],
          ['aggressiveness', 'AGGRESSIVENESS'],
          ['fertility', 'FERTILITY'],
          ['startingFertility', 'START_FERTILITY'],
          ['age', 'AGE'],
          ['id', 'ID'],
          ['pickFightOwner', 'PICKFIGHT_OWNER'],
          ['chooseMateOwner', 'CHOOSEMATE_OWNER'],
          ['mateAnswerOwner', 'MATEANSWER_OWNER']];
    // Assign 'this' to a variable for use in the closures below.
    var thisBlock = this;
    this.setColour(Genetics.Blocks.GENETICS_HUE);
    this.setOutput(true, 'Number');
    var dropdown = new Blockly.FieldDropdown(PROPERTIES, function(newProp) {
      thisBlock.updateType_(newProp);
    });
    this.appendValueInput('MOUSE')
        .setCheck('Mouse');
    this.appendDummyInput()
        .appendField('.')
        .appendField(dropdown, 'PROPERTY');
    this.setTooltip(function() {
      var property = thisBlock.getFieldValue('PROPERTY');
      var TOOLTIPS = {
        'SIZE': BlocklyGames.getMsg('Genetics_sizeTooltip'),
        'AGGRESSIVENESS': BlocklyGames.getMsg('Genetics_aggressivenessTooltip'),
        'FERTILITY': BlocklyGames.getMsg('Genetics_fertilityTooltip'),
        'START_FERTILITY': BlocklyGames.getMsg('Genetics_startFertilityTooltip'),
        'AGE': BlocklyGames.getMsg('Genetics_ageTooltip'),
        'ID': BlocklyGames.getMsg('Genetics_idTooltip'),
        'PICKFIGHT_OWNER': BlocklyGames.getMsg('Genetics_pickFightOwnerTooltip'),
        'CHOOSEMATE_OWNER': BlocklyGames.getMsg('Genetics_chooseMateOwnerTooltip'),
        'MATEANSWER_OWNER': BlocklyGames.getMsg('Genetics_mateAnswerOwnerTooltip')
      };
      return TOOLTIPS[property];
    });
  },
  /**
   * Modify this block to have the correct output type.
   * @param {string} newProp Either a property requesting a function owner that
   * returns a string or a property that returns a number.
   * @private
   * @this Blockly.Block
   */
  updateType_: function(newProp) {
    if (newProp == 'PICKFIGHT_OWNER' || newProp == 'CHOOSEMATE_OWNER' ||
        newProp == 'MATEANSWER_OWNER') {
      this.outputConnection.setCheck('String');
    } else {
      this.outputConnection.setCheck('Number');
    }
  }
};

Blockly.JavaScript['genetics_getProperties'] = function(block) {
  // Generate JavaScript for getting mouse property.
  var value_mouse = Blockly.JavaScript.valueToCode(block, 'MOUSE',
          Blockly.JavaScript.ORDER_NONE) || 0;
  var value_field = Blockly.JavaScript.valueToCode(block, 'FIELD',
          Blockly.JavaScript.ORDER_NONE) || 0;
  var code = value_mouse + '.' + value_field;
  return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};