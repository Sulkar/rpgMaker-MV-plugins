//=============================================================================
// RSPlugin CombatText
//=============================================================================

/*:
 * @plugindesc Combat Text
 *
 * @author RS
 *
 * @param backOpacity
 * @desc Changes the opacity of text background
 * default: 96 ( 0 ～ 255 )
 * @default 96
 *
 * @param fontSize
 * @desc Changes the font size.
 * default: 20
 * @default 20
 *
 * @param outlineWidth
 * @desc Changes the outline width.
 * default: 4
 * @default 4
 *
 * @param outlineColor
 * @desc Changes the outline color.
 * default: rgba(0, 0, 0, 0.5)
 * @default rgba(0, 0, 0, 0.5)
 *
 * @param width
 * @desc Set the width of the text.
 * default: 160
 * @default 160
 *
 *
 * @help
 * This is a very simple combat text plugin, that can be used on the map with events.
 * RSCombatText 0 "Hello my Name is Richard" or RSCombatText 0 "Variable value: \V[3]"
 */

var Imported = Imported || {};
Imported.RSCombatText = true;

var RSPlugin = RSPlugin || {};
RSPlugin.CombatText = {};
RSPlugin.CombatText.Parameters = PluginManager.parameters("RSCombatText");
RSPlugin.CombatText.BackOpacity = +(RSPlugin.CombatText.Parameters["backOpacity"] || 0);
RSPlugin.CombatText.FontSize = +(RSPlugin.CombatText.Parameters["fontSize"] || 20);
RSPlugin.CombatText.OutlineWidth = +(RSPlugin.CombatText.Parameters["outlineWidth"] || 4);
RSPlugin.CombatText.OutlineColor = RSPlugin.CombatText.Parameters["outlineColor"] || "rgba(0, 0, 0, 0.5)";
RSPlugin.CombatText.Width = +(RSPlugin.CombatText.Parameters["width"] || 160);

//allgemeine funktionen die nur einmal erstellt werden und dem Game_Interpreter hinzugefügt werden
if (!RSPlugin.InterpreterBase) {
  RSPlugin.InterpreterBase = true;
  (function () {
    Game_Interpreter.prototype.convertEscapeCharactersRS = function (text) {
      text = text.replace(/\\/g, "\x1b");
      text = text.replace(/\x1b\x1b/g, "\\");
      text = text.replace(
        /\x1bV\[(\d+)\]/gi,
        function () {
          return $gameVariables.value(parseInt(arguments[1]));
        }.bind(this)
      );
      text = text.replace(
        /\x1bN\[(\d+)\]/gi,
        function () {
          return this.actorNameTM(parseInt(arguments[1]));
        }.bind(this)
      );
      text = text.replace(
        /\x1bP\[(\d+)\]/gi,
        function () {
          return this.partyMemberNameTM(parseInt(arguments[1]));
        }.bind(this)
      );

      text = text.replace(/\x1bG/gi, TextManager.currencyUnit);
      return text;
    };

    //build custom args array to display texts with spaces
    //i.e.: CombatText 0 "Hello my Name is Richard" or "Variable value: \V[3]"
    Game_Interpreter.prototype.buildCustomArgs = function (args) {
      var customArgs = [];
      var text = "";
      var lastElementWasText = false;
      args.forEach((element) => {
        if (element.slice(-1) == '"') {
          text += " " + element.replace('"', "");
          lastElementWasText = false;
          customArgs.push(text);
          text = "";
        } else if (element[0] == '"') {
          text += element.replace('"', "");
          lastElementWasText = true;
        } else if (lastElementWasText) {
          text += " " + element;
        } else {
          customArgs.push(element);
        }
      });
      return customArgs;
    };

    Game_Interpreter.prototype.actorNameTM = function (n) {
      var actor = n >= 1 ? $gameActors.actor(n) : null;
      return actor ? actor.name() : "";
    };

    Game_Interpreter.prototype.partyMemberNameTM = function (n) {
      var actor = n >= 1 ? $gameParty.members()[n - 1] : null;
      return actor ? actor.name() : "";
    };
  })();
}

(function () {
  //-----------------------------------------------------------------------------
  // Game_CharacterBase Klasse -> allgemeine Funktionen die im dem aktuellen Character oder Event properties zuweist
  //

  Game_CharacterBase.prototype.setCombatText = function (combatText, shiftY) {
    this._namePop = combatText;
    this._combatTextY = shiftY || 0;
  };

  Game_CharacterBase.prototype.namePopOutlineColor = function () {
    return this._combatTextOutlineColor || RSPlugin.CombatText.OutlineColor;
  };

  Game_CharacterBase.prototype.setNamePopOutlineColor = function (outlineColor) {
    this._combatTextOutlineColor = outlineColor;
  };

  //-----------------------------------------------------------------------------
  // Game_Interpreter Klasse -> Event Command call
  //

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command === "RSCombatText") {
      var customArgs = this.buildCustomArgs(args);
      var character = this.character(+customArgs[0]); //actor or event
      if (character) {
        var specialArgs = customArgs.map(this.convertEscapeCharactersRS, this);
        character.setCombatText(specialArgs[1], specialArgs[2]);
        character.setNamePopOutlineColor(specialArgs[3]);
        character._createNewPopUp = true;

        var combatText = {};
        combatText._duration = 100;
        combatText._sprCombatText = new Sprite_CombatText();
        combatText._isPlaying = false;
        if (character._combatTextArray == undefined) character._combatTextArray = [];
        character._combatTextArray.push(combatText);
      }
    }
  };

  //-----------------------------------------------------------------------------
  // Sprite_Character Klasse -> ist der aktuelle char oder das event
  //
  var _Sprite_Character_update = Sprite_Character.prototype.update; //UPDATE METHODE läuft immer, wenn das Spiel gestartet ist
  Sprite_Character.prototype.update = function () {
    _Sprite_Character_update.call(this);
    this.addCombatText();
  };

  Sprite_Character.prototype.addCombatText = function () {
    if (this._character._combatTextArray != undefined) {
      this._character._combatTextArray.forEach((combatTextElement) => {
        if (!combatTextElement._isPlaying) {
          combatTextElement._isPlaying = true;
          this.addChild(combatTextElement._sprCombatText);
          combatTextElement._sprCombatText.y = this.combatTextShiftY();
          combatTextElement._sprCombatText.refresh(this._character._namePop, "rgba(0, 0, 0, 0.5)");
        }
      });
    }
  };

  Sprite_Character.prototype.combatTextShiftY = function () {
    return this._character._combatTextY - this.patternHeight();
  };

  Sprite_Character.prototype.removeCombatTextObject = function (combatTextObject) {
    this.removeChild(combatTextObject);
  };

  //-----------------------------------------------------------------------------
  // eigene Klasse die von Sprite erbt: Sprite_CombatText
  //

  function Sprite_CombatText() {
    this.initialize.apply(this, arguments);
  }

  Sprite_CombatText.prototype = Object.create(Sprite.prototype);
  Sprite_CombatText.prototype.constructor = Sprite_CombatText;

  Sprite_CombatText.prototype.initialize = function () {
    Sprite.prototype.initialize.call(this);
    this.bitmap = new Bitmap(RSPlugin.CombatText.Width, RSPlugin.CombatText.FontSize + 4);
    this.bitmap.fontSize = RSPlugin.CombatText.FontSize;
    this.bitmap.outlineWidth = RSPlugin.CombatText.OutlineWidth;
    this.anchor.x = 0.5;
    this.anchor.y = 1;
    this._duration = 100;
  };

  Sprite_CombatText.prototype.update = function () {
    //UPDATE METHODE läuft nachdem Event ausgelöst wurde
    Sprite.prototype.update.call(this);
    if (this._duration % 5 == 0) {
      this.y -= 3;
    }
    if (this._duration > 0) {
      this._duration--;
      if (this._duration > 0) {
      } else {
        this.parent.removeCombatTextObject(this);
      }
    }
  };

  Sprite_CombatText.prototype.refresh = function (text, outlineColor) {
    this.bitmap.clear();
    this.bitmap.textColor = "#ffffff";
    this.bitmap.outlineColor = outlineColor;
    text = this.convertEscapeCharacters(text);
    var tw = this.bitmap.measureTextWidth(text);
    var x = Math.max((this.width - tw) / 2 - 4, 0);
    var w = Math.min(tw + 8, this.width);
    this.bitmap.paintOpacity = RSPlugin.CombatText.BackOpacity;
    this.bitmap.fillRect(x, 0, w, this.height, "#000000");
    this.bitmap.paintOpacity = 255;
    this.bitmap.drawText(text, 0, 0, this.width, this.height, "center");
  };

  Sprite_CombatText.prototype.convertEscapeCharacters = function (text) {
    text = text.replace(
      /\x1bC\[(\d+)\]/gi,
      function () {
        this.bitmap.textColor = this.textColor(arguments[1]);
        return "";
      }.bind(this)
    );
    return text;
  };

  Sprite_CombatText.prototype.textColor = function (n) {
    var px = 96 + (n % 8) * 12 + 6;
    var py = 144 + Math.floor(n / 8) * 12 + 6;
    var windowskin = ImageManager.loadSystem("Window");
    return windowskin.getPixel(px, py);
  };
})();
