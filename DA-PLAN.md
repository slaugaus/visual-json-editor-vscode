# DA PLAN...

## READY TO DEVELOP

* FEAT: KEYBOARD NAV - "like writing YAML" or something
* QOL: Up/down buttons cause scrolling like in Colab
* QOL: Allow conversion of "empty" items ("", 0, etc.)
* QOL: Allow array to object. It's safe, just needs a special case in the converter
* QOL: If first load or edit playback take longer than 1-2 sec, put up a loading overlay to prevent mischief
* QOL: Register an "open text editor to the side" action in the per-tab button list? Is that a language feature?
* FEAT: On-hover "add between" button like notebooks
* FEAT: Support more color and datetime formats + format picker dropdown (inside value)
* BUG: Bools occasionally save as strings for some reason? Haven't properly tested/found
* SILLY: Convert objects and arrays to strings

## OTHER THOUGHTS

* Publish your stuff to https://open-vsx.org/ too

* Editor's save (HTML -> object) must fail safe, so “emergency exits” don't lose data
  * Dumping jsonContainer.innerHTML wouldn't work as event listeners would be lost

* “File modified externally,” probably an event that can be listened for, should do something.
  * JsonDocument.onDidChangeContent does NOT do this (if you modify in a different editor)

### OLD UX PLANS

* Simple Mode & View Mode
  * Hides any nonessential clutter you've added
  * Hides all editing features
* LARGE FILES
  * CONFIG: File size threshold to not open
  * On-Demand Mode: Only load the top level, collapsed, as editables... load more (also collapsed) when thing is unfolded. Implement as class "unloaded" [json content]
    * Activated when file is large

### STRETCH GOALS

#### Support Schema

Constrain all "new thing" buttons to what the schema allows

* Different "new thing" combobox limited to "name (type)"

OR (lazy) run a validator on save and complain about errors

#### Support YAML, TOML, etc.

"JSON is a subset of YAML"

Constrained to what JS objects can serialize to & what the package you find supports. In this household we don't reinvent the wheel

* YAML may have sugar that gets lost?
* TOML smells like INI, which doesn't smoothly convert to JSON

#### Live(ish?) Preview

True bidirectional sync would SUCK in every way,

HOWEVER a stripped down view-only mode could be a nice language feature to add, maybe even as a separate extension

* Viewer could perhaps be an on-build flag that packs in only the view mode? Some kind of #ifdef situation?
