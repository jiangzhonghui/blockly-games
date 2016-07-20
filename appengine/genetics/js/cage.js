/**
 * Blockly Games: Genetics
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
 * @fileoverview JavaScript for the game logic for the Genetics game.
 * @author kozbial@google.com (Monica Kozbial)
 */
'use strict';

goog.provide('Genetics.Cage');

goog.require('Genetics.Mouse');

/**
 * The maximum population in a cage.
 * @type {number}
 */
Genetics.Cage.MAX_POPULATION = 10;

/**
 * Mapping of player id to and array with player name and code.
 * @type {!Object.<number, Array.<string>>}
 */
Genetics.Cage.PLAYERS = {};

/**
 * Whether the simulation is running without a visualization.
 * @type {boolean}
 */
Genetics.Cage.HEADLESS = false;

/**
 * List of mice currently alive.
 * @type {!Array.<Genetics.Mouse>}
 * @private
 */
Genetics.Cage.aliveMice_ = [];

/**
 * Mapping of mouse id to mouse for quick lookup.
 * @type {!Object.<number, Genetics.Mouse>}
 * @private
 */
Genetics.Cage.miceMap_ = {};

/**
 * Mapping of mouse id to PID of life simulation for that mouse queued to run.
 * @type {!Object.<number, number>}
 * @private
 */
Genetics.Cage.mouseLife_ = {};

/**
 * List of events to be visualized.
 * @type {!Array.<!Event>}
 */
Genetics.Cage.EVENTS = [];

/**
 * Template for event properties.
 * @type {Object.<string, Array.<string>>}
 */
Genetics.Cage.EVENT_TEMPLATE = {
  'ADD': ['TYPE', 'MOUSE', 'PLAYER_NAME'],
  'FIGHT': ['TYPE', 'ID', 'RESULT', 'OPT_OPPONENT'],
  'MATE': ['TYPE', 'ID', 'RESULT', 'OPT_PARTNER', 'OPT_OFFSPRING'],
  // A mouse dies after using all fight and mate opportunities.
  'RETIRE': ['TYPE', 'ID'],
  // The oldest mouse dies when there is no room for it.
  'OVERPOPULATION': ['TYPE', 'ID'],
  // A mouse dies if it throws an exception.
  'EXPLODE': ['TYPE', 'ID', 'SOURCE', 'CAUSE'],
  // A mouse dies if it does not complete execution.
  'SPIN': ['TYPE', 'ID'],
  'END_GAME': ['TYPE', 'CAUSE', 'PICK_FIGHT_WINNER', 'CHOOSE_MATE_WINNER',
    'MATE_ANSWER_WINNER']
};

/**
 * Creates an event.
 * @param {string } type The type of event.
 * @param {...string|number|Genetics.Mouse} var_args The properties on
 * the event.
 * @constructor
 */
Genetics.Cage.Event = function(type, var_args) {
  var template = Genetics.Cage.EVENT_TEMPLATE[type];
  for (var i = 0; i < template.length; i++) {
    this[template[i]] = arguments[i];
  }
};

/**
 * Adds the event to the queue depending on the mode the game is running as.
 */
Genetics.Cage.Event.prototype.addToQueue = function() {
  // Headless does not need to keep track of events that are not end game.
  if (Genetics.Cage.HEADLESS &&
    this.TYPE != Genetics.Cage.EVENT_TEMPLATE.END_GAME) {
    return;
  }
  Genetics.Cage.EVENTS.push(this);
};

/**
 * Time to end the battle.
 * @type {number}
 * @private
 */
Genetics.Cage.endTime_ = 0;

/**
 * Time limit of game (in milliseconds).
 * @type {number}
 */
Genetics.Cage.GAME_TIME_LIMIT = 5 * 60 * 1000;

/**
 * Time limit for mouse function execution in number of interpreter steps (100k
 * ticks runs for about 3 minutes).
 * @type {number}
 */
Genetics.Cage.FUNCTION_TIMEOUT = 100000;

/**
 * The next available player id.
 * @type {number}
 * @private
 */
Genetics.Cage.playerId_ = 0;

/**
 * The next available mouse id.
 * @type {number}
 * @private
 */
Genetics.Cage.mouseId_ = 0;

/**
 * Callback function for end of game.
 * @type {Function}
 * @private
 */
Genetics.Cage.doneCallback_ = null;


/**
 * Stop and reset the cage.
 */
Genetics.Cage.reset = function() {
  clearTimeout(Genetics.Cage.pid);
  Genetics.Cage.EVENTS.length = 0;
  Genetics.Cage.aliveMice_.length = 0;
  Genetics.Cage.miceMap_ = {};
  // Cancel all queued life simulations.
  for (var mouseId in Genetics.Cage.mouseLife_) {
    if (Genetics.Cage.mouseLife_.hasOwnProperty(mouseId)) {
      clearTimeout(Genetics.Cage.mouseLife_[mouseId]);
    }
  }
  Genetics.Cage.mouseLife_ = {};
  Genetics.Cage.mouseId_ = 0;
};

/**
 * Adds a player to the game.
 * @param {string} playerName The name of the player to be added.
 * @param {string|!Function} code Player's code, or generator.
 */
Genetics.Cage.addPlayer = function(playerName, code) {
  // Assign a unique id to the player and add to the game.
  var id = Genetics.Cage.playerId_++;
  Genetics.Cage.PLAYERS[id] = [playerName, code];
};

/**
 * Start the Cage simulation. Players should be already added
 * @param {Function} doneCallback Function to call when game ends.
 */
Genetics.Cage.start = function(doneCallback) {
  Genetics.Cage.doneCallback_ = doneCallback;
  // Create a mouse for each player.
  for (var playerId in Genetics.Cage.PLAYERS) {
    if (Genetics.Cage.PLAYERS.hasOwnProperty(playerId)) {
      var mouseId = Genetics.Cage.mouseId_++;
      var mouse = new Genetics.Mouse(mouseId, null, null, playerId);
      Genetics.Cage.aliveMice_[mouse.id] = mouse;
      Genetics.Cage.miceMap_[mouse.id] = mouse;
      Genetics.Cage.life(mouse); // Queue life simulation for mouse.
      new Genetics.Cage.Event('ADD', mouse,
          Genetics.Cage.PLAYERS[playerId][0]).addToQueue();
    }
  }
  Genetics.Cage.endTime_ = Date.now() + Genetics.Cage.GAME_TIME_LIMIT;
  console.log('Starting game with ' +
      Object.keys(Genetics.Cage.PLAYERS).length + ' players.');
};

/**
 * Queues life simulation for mouse.
 * @param {Genetics.Mouse} mouse The mouse to queue the simulation for.
 */
Genetics.Cage.life = function(mouse) {
  // Queue life simulation for mouse with some variation in timeout to allow for
  // variation in order.
  Genetics.Cage.mouseLife_[mouse.id] =
      setTimeout(goog.partial(Genetics.Cage.simulateLife, mouse),
          10 * Math.random());
};

/**
 * Runs life simulation on mouse.
 * @param {Genetics.Mouse} mouse The mouse to run the simulation for.
 */
Genetics.Cage.simulateLife = function(mouse) {
  // Remove life from mapping of lives that are queued to run.
  delete Genetics.Cage.mouseLife_[mouse.id];
  // Age mouse.
  mouse.age++;
  // If mouse has fight left in it, start a fight with another mouse.
  if (mouse.aggressiveness > 0) {
    Genetics.Cage.instigateFight(mouse);
    mouse.aggressiveness--;
  }
  // If mouse is still fertile, try to breed with another mice.
  else if (mouse.fertility > 0) {
    Genetics.Cage.tryMate(mouse);
    mouse.fertility--;
  }
  // If mouse has finished fighting and breeding, it dies.
  else {
    new Genetics.Cage.Event('RETIRE', mouse.id).addToQueue();
    Genetics.Cage.death(mouse);
  }
  // Queue life simulation again if mouse is still alive.
  if (Genetics.Cage.isAlive(mouse)) {
    Genetics.Cage.life(mouse);
  }
  // Check for end game.
  Genetics.Cage.checkForEnd();
};

/**
 * Gets requested opponent of mouse, attempts fight and kills losing mouse.
 * @param {Genetics.Mouse} mouse The mouse to initiate fighting.
 */
Genetics.Cage.instigateFight = function(mouse) {
  var result = Genetics.Cage.runMouseFunction(mouse, 'pickFight');
  // Check if function threw an error or caused a timeout.
  if (result[0] == 'FAILURE') {
    return;
  }
  var chosen = result[1];
  // Check if no mouse was chosen.
  if (chosen == null) {
    new Genetics.Cage.Event('FIGHT', mouse.id, 'NONE').addToQueue();
    mouse.aggressiveness = 0;
    return;
  }
  // Check if return value is invalid
  if (typeof chosen != 'object' ||
      Genetics.Cage.miceMap_[chosen.id] == undefined) {
    new Genetics.Cage.Event('FIGHT', mouse.id, 'INVALID').addToQueue();
    mouse.aggressiveness = 0;
    return;
  }
  // Retrieve local copy of mouse to ensure that mouse was not modified.
  var opponent = Genetics.Cage.miceMap_[chosen.id];
  // Check if opponent is itself.
  if (mouse.id == opponent.id) {
    new Genetics.Cage.Event('FIGHT', mouse.id, 'SELF').addToQueue();
    Genetics.Cage.death(mouse);
    return;
  }
  // Compute winner using size to weigh probability of winning.
  var fightResult = Math.random() - mouse.size / (mouse.size + opponent.size);
  if (fightResult < 0) {  // If fight proposer won.
    new Genetics.Cage.Event('FIGHT', mouse.id, 'WIN', opponent.id).addToQueue();
    Genetics.Cage.death(opponent);
  }
  else if (fightResult == 0) {  // If it was a tie.
    new Genetics.Cage.Event('FIGHT', mouse.id, 'TIE', opponent.id).addToQueue();
  } else {  // If opponent won.
    new Genetics.Cage.Event('FIGHT', mouse.id, 'LOSS', opponent.id)
        .addToQueue();
    Genetics.Cage.death(mouse);
  }
};

/**
 * Gets requested mate of mouse, attempts mating and starts life of any
 * resultant child.
 * @param {Genetics.Mouse} mouse The mouse to initiate mating.
 */
Genetics.Cage.tryMate = function(mouse) {
  var result = Genetics.Cage.runMouseFunction(mouse, 'chooseMate');
  // Check if function threw an error or caused a timeout.
  if (result[0] == 'FAILURE') {
    return;
  }
  var chosen = result[1];
  // Check if no mouse was chosen.
  if (chosen == null) {
    new Genetics.Cage.Event('MATE', mouse.id, 'NONE').addToQueue();
    mouse.fertility = 0;
    return;
  }
  // Check if return value is invalid
  if (typeof chosen != 'object' ||
      Genetics.Cage.miceMap_[chosen.id] == undefined) {
    new Genetics.Cage.Event('MATE', mouse.id, 'INVALID').addToQueue();
    mouse.fertility = 0;
    return;
  }
  // Retrieve local copy of mouse to ensure that mouse was not modified.
  var mate = Genetics.Cage.miceMap_[chosen.id];
  if (Genetics.Cage.isMatingSuccessful(mouse, mate)) {
    mate.fertility--;
    // Create offspring with these mice.
    var mouseId = Genetics.Cage.mouseId_++;
    var child = new Genetics.Mouse(mouseId, mouse, mate);
    Genetics.Cage.born(child, mouse.id, mate.id);
    // Accounts for overpopulation.
    while (Genetics.Cage.aliveMice_.length > Genetics.Cage.MAX_POPULATION) {
      // Find oldest mouse.
      var oldestMouse = Genetics.Cage.aliveMice_[0];
      for (var i = 1; i < Genetics.Cage.aliveMice_.length; i++) {
        var aliveMouse = Genetics.Cage.aliveMice_[i];
        if (!oldestMouse || aliveMouse.age > oldestMouse.age) {
          oldestMouse = aliveMouse;
        }
      }
      // Kill oldest mouse.
      new Genetics.Cage.Event('OVERPOPULATION', oldestMouse.id).addToQueue();
      Genetics.Cage.death(oldestMouse);
    }
  }
};

/**
 * Checks whether a mate between the two mice will succeed.
 * @param {Genetics.Mouse} proposingMouse The mouse that is proposing to mate.
 * @param {Genetics.Mouse} askedMouse The mouse that is being asked to mate.
 * @return {boolean} Whether the mate succeeds.
 */
Genetics.Cage.isMatingSuccessful = function(proposingMouse, askedMouse) {
  // Check if mice are the same.
  if (proposingMouse.id == askedMouse.id) {
    new Genetics.Cage.Event('MATE', proposingMouse.id, 'SELF').addToQueue();
    return false;
  }
  // Check if mice are not of compatible sex.
  if (proposingMouse.sex != Genetics.Mouse.Sex.HERMAPHRODITE &&
      proposingMouse.sex == askedMouse.sex) {
    new Genetics.Cage.Event('MATE', proposingMouse.id, 'INCOMPATIBLE',
        askedMouse.id).addToQueue();
    return false;
  }
  // Check if other mouse is infertile.
  if (askedMouse.fertility < 1) {
    new Genetics.Cage.Event('MATE', proposingMouse.id, 'INFERTILE',
        askedMouse.id).addToQueue();
    return false;
  }
  // Ask second mouse whether it will mate with the proposing mouse.
  var result = Genetics.Cage.runMouseFunction(askedMouse, 'mateAnswer',
      proposingMouse);
  // Check if function threw an error or caused a timeout.
  if (result[0] == 'FAILURE') {
    new Genetics.Cage.Event('MATE', proposingMouse.id, 'MATE_EXPLODED')
        .addToQueue();
    return false;
  }
  var response = result[1];
  // Check if response is positive.
  if (!response) {
    new Genetics.Cage.Event('MATE', proposingMouse.id, 'REJECTION',
        askedMouse.id).addToQueue();
    return false;
  }
  return true;
};

/**
 * Adds the mouse to the cage.
 * @param {Genetics.Mouse} mouse The mouse to add to the cage.
 * @param {number} parentOneId The ID of the parent of the mouse.
 * @param {number} parentTwoId The ID of the parent of the mouse.
 */
Genetics.Cage.born = function(mouse, parentOneId, parentTwoId) {
  // Adds child to population.
  Genetics.Cage.aliveMice_.push(mouse);
  Genetics.Cage.miceMap_[mouse.id] = mouse;
  new Genetics.Cage.Event('MATE', parentOneId, 'SUCCESS', parentTwoId,
      mouse).addToQueue();
  Genetics.Cage.life(mouse);
};

/**
 * Kills the mouse.
 * @param {Genetics.Mouse} mouse The mouse to kill.
 */
Genetics.Cage.death = function(mouse) {
  var index = Genetics.Cage.aliveMice_.indexOf(mouse);
  if (index > -1) {
    Genetics.Cage.aliveMice_.splice(index, 1);
  }
  delete Genetics.Cage.miceMap_[mouse.id];
  clearTimeout(Genetics.Cage.mouseLife_[mouse.id]);
  delete Genetics.Cage.mouseLife_[mouse.id];
};

/**
 * Checks if mouse is alive.
 * @param {Genetics.Mouse} mouse The mouse to check whether it is alive.
 * @return {boolean} True if mouse is alive, false otherwise.
 */
Genetics.Cage.isAlive = function(mouse) {
  return (Genetics.Cage.aliveMice_.indexOf(mouse) > -1);
};

/**
 * Stops the game if end condition is met.
 */
Genetics.Cage.checkForEnd = function() {
  // Check if there are no mice left.
  if (Genetics.Cage.aliveMice_.length == 0) {
    Genetics.Cage.end('NONE_LEFT');
    return;
  }
  // Check if there is one mouse left.
  else if (Genetics.Cage.aliveMice_.length == 1) {
    var aliveMouse = Genetics.Cage.aliveMice_[0];
    Genetics.Cage.end('ONE_LEFT', aliveMouse.pickFightOwner,
        aliveMouse.chooseMateOwner, aliveMouse.mateAnswerOwner);
    return;
  }
  // Check if there's no possible mate pairings left.
  var potentialMate = null;
  var matesExist = false;
  for (var i = 0; i < Genetics.Cage.aliveMice_.length; i++) {
    var mouse = Genetics.Cage.aliveMice_[i];
    if (mouse.fertility > 0) {
      if (!potentialMate) {
        potentialMate = mouse;
      }
      else if (potentialMate.sex == Genetics.Mouse.Sex.HERMAPHRODITE ||
          potentialMate.sex != mouse.sex) {
        matesExist = true;
        break;
      }
    }
  }
  // Check which genes have won.
  var pickFightWinner = Genetics.Cage.aliveMice_[0].pickFightOwner;
  var mateQuestionWinner = Genetics.Cage.aliveMice_[0].chooseMateOwner;
  var mateAnswerWinner = Genetics.Cage.aliveMice_[0].mateAnswerOwner;
  for (var i = 1; i < Genetics.Cage.aliveMice_.length; i++) {
    var mouse = Genetics.Cage.aliveMice_[i];
    if (pickFightWinner && pickFightWinner != mouse.pickFightOwner) {
      pickFightWinner = null;
    }
    if (mateQuestionWinner && mateQuestionWinner != mouse.chooseMateOwner) {
      mateQuestionWinner = null;
    }
    if (mateAnswerWinner && mateAnswerWinner != mouse.mateAnswerOwner) {
      mateAnswerWinner = null;
    }
    if (!pickFightWinner && !mateQuestionWinner && !mateAnswerWinner) {
      break;
    }
  }
  // If the game is stalemated because there are no mate pairings left or if
  // there is a winner for all functions.
  if (!matesExist) {
    Genetics.Cage.end('STALEMATE', pickFightWinner, mateQuestionWinner,
        mateAnswerWinner);
  }
  else if (pickFightWinner && mateQuestionWinner && mateAnswerWinner) {
    Genetics.Cage.end('DOMINATION', pickFightWinner, mateQuestionWinner,
        mateAnswerWinner);
  }
};

/**
 * Clears queued events for end of simulation.
 * @param {string} cause The cause of game end.
 * @param {string=} opt_pickFightWinner The owner of all the pickFight functions
 * in alive mice.
 * @param {string=} opt_chooseMateWinner The owner of all the chooseMate
 * functions in alive mice.
 * @param {string=} opt_mateAnswerWinner The owner of all the mateAnswer
 * functions in alive mice.
 */
Genetics.Cage.end = function(cause, opt_pickFightWinner, opt_chooseMateWinner,
    opt_mateAnswerWinner) {
  // Cancel all queued life simulations.
  for (var mouseId in Genetics.Cage.mouseLife_) {
    if (Genetics.Cage.mouseLife_.hasOwnProperty(mouseId)) {
      clearTimeout(Genetics.Cage.mouseLife_[mouseId]);
    }
  }
  var pickFightWinner = opt_pickFightWinner || 'NONE';
  var chooseMateWinner = opt_chooseMateWinner || 'NONE';
  var mateAnswerWinner = opt_mateAnswerWinner || 'NONE';
  new Genetics.Cage.Event('END_GAME', cause, pickFightWinner, chooseMateWinner,
      mateAnswerWinner).addToQueue();
};

/**
 * Starts up a new interpreter and gets the return value of the function.
 * @param {!Genetics.Mouse} mouse The mouse to get the code from.
 * @param {string} mouseFunction The function call to evaluate.
 * @param {Genetics.Mouse=} opt_param The mouse passed as a parameter to the
 * function.
 * @return {Array.<*>}
 */
Genetics.Cage.runMouseFunction = function(mouse, mouseFunction, opt_param) {
  // Get a new interpreter to run the player code.
  var interpreter = Genetics.Cage.getInterpreter(mouse, mouseFunction,
      opt_param);
  // Try running the player code.
  try {
    var ticks = Genetics.Cage.FUNCTION_TIMEOUT;
    while (interpreter.step()) {
      if (ticks-- == 0) {
        throw Infinity;
      }
    }
    return ['SUCCESS', interpreter.pseudoToNative(interpreter.value)];
  } catch (e) {
    if (e === Infinity) {
      new Genetics.Cage.Event('SPIN', mouse.id, mouseFunction)
          .addToQueue();
    } else {
      new Genetics.Cage.Event('EXPLODE', mouse.id, mouseFunction, e)
          .addToQueue();
    }
  }
  // Failed to retrieve a return value.
  Genetics.Cage.death(mouse);
  return ['FAILURE'];
};

/**
 * Returns an interpreter with player code from the mouse for the given
 * mouseFunction with a call appended.
 * @param {!Genetics.Mouse} mouse The mouse to get the code from.
 * @param {string} mouseFunction The function call to append to the code in the
 * interpreter.
 * @param {Genetics.Mouse=} opt_suitor The mouse passed as a parameter to the
 * function (for mateAnswer function call).
 * @return {!Interpreter} Interpreter set up for executing mouse function call.
 */
Genetics.Cage.getInterpreter = function(mouse, mouseFunction, opt_suitor) {
  var playerId;
  switch (mouseFunction) {
    case 'pickFight':
      playerId = mouse.pickFightOwner;
      break;
    case 'chooseMate':
      playerId = mouse.chooseMateOwner;
      break;
    case 'mateAnswer':
      playerId = mouse.mateAnswerOwner;
      break;
  }
  var code = Genetics.Cage.PLAYERS[playerId][1];
  if (goog.isFunction(code)) {
    code = code();
  } else if (!goog.isString(code)) {
    var player = Genetics.Cage.PLAYERS[playerId][0];
    throw 'Player ' + player + ' has invalid code: ' + code;
  }
  var interpreter = new Interpreter(code,
      goog.partial(Genetics.Cage.initInterpreter, mouse, opt_suitor));
  // Overwrite other function calls and call function we need return value of.
  switch (mouseFunction) {
    case 'pickFight':
      interpreter.appendCode('chooseMate = null;');
      interpreter.appendCode('mateAnswer = null;');
      interpreter.appendCode('pickFight();');
      break;
    case 'chooseMate':
      interpreter.appendCode('pickFight = null;');
      interpreter.appendCode('mateAnswer = null;');
      interpreter.appendCode('chooseMate();');
      break;
    case 'mateAnswer':
      interpreter.appendCode('pickFight = null;');
      interpreter.appendCode('chooseMate = null;');
      interpreter.appendCode('mateAnswer(getSuitor());');
      break;
  }
  return interpreter;
};

/**
 * Inject the Genetics API into a JavaScript interpreter.
 * @param {!Genetics.Mouse} mouse The mouse that is running the function.
 * @param {!Genetics.Mouse|undefined} suitor The mouse passed as a parameter to
 * the function (for mateAnswer function call).
 * @param {!Interpreter} interpreter The JS interpreter.
 * @param {!Object} scope Global scope.
 */
Genetics.Cage.initInterpreter = function(mouse, suitor, interpreter,
    scope) {
  var pseudoMe = interpreter.UNDEFINED;
  var pseudoSuitor = interpreter.ARRAY;
  var pseudoAliveMice = interpreter.createObject(interpreter.ARRAY);
  var aliveMice = Genetics.Cage.aliveMice_;
  for (var i = 0; i < aliveMice.length; i++) {
    var pseudoMouse = interpreter.nativeToPseudo(aliveMice[i]);
    interpreter.setProperty(pseudoAliveMice, i, pseudoMouse);
    // Check if the mouse running the interpreter has been created.
    if (aliveMice[i].id == mouse.id) {
      pseudoMe = pseudoMouse;
    }
    // Check if the suitor parameter, if defined, has been created.
    else if (suitor && aliveMice[i].id == suitor.id) {
      pseudoSuitor = pseudoMouse;
    }
  }
  var wrapper;
  wrapper = function() {
    return pseudoMe;
  };
  interpreter.setProperty(scope, 'getSelf',
      interpreter.createNativeFunction(wrapper));
  wrapper = function() {
    return pseudoAliveMice;
  };
  interpreter.setProperty(scope, 'getMice',
      interpreter.createNativeFunction(wrapper));
  if (pseudoSuitor != interpreter.UNDEFINED) {
    wrapper = function() {
      return pseudoSuitor;
    };
    var x = interpreter.createNativeFunction(wrapper);
    interpreter.setProperty(scope, 'getSuitor', x);
  }

  var sex = interpreter.nativeToPseudo(Genetics.Mouse.Sex);
  interpreter.setProperty(scope, 'Sex', sex);

  var myMath = interpreter.getProperty(scope, 'Math');
  if (myMath != interpreter.UNDEFINED) {
    wrapper = function(minValue, maxValue) {
      return interpreter.createPrimitive(
          Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue);
    };
    interpreter.setProperty(myMath, 'randomInt',
        interpreter.createNativeFunction(wrapper));
  }
};
