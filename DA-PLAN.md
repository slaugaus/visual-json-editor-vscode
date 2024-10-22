# DA PLAN...

## SCRATCHPAD

BUG: fake-input dies if you delete everything in it

BUG: When editing names, space toggles the details

BUG: **SNEAKY DATA LOSS PROBLEM: Objects can't have 2 items w/ the same name (on the same level), so don't allow this in the editor!**

- Checking on (name) save is probably the way to go here

**Syncing per edit isn't THAT hard, just fire an event with the change and the item's ancestry. There will be snags and renaming will need to be handled, but it's not as bad as you made it out to be.**

- This opens a path to Undo/Redo
- Save should still do a full serialize (for now) to compare
  - (Temp check during dev) "Serializer and edit playback produced different files. Saving one as (uri.bak) so you can diff them."
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

Editor's save (HTML -> object) must fail safe, so “emergency exits” don't lose data

- Dumping jsonContainer.innerHTML wouldn't work as event listeners would be lost

If the editor fails to load from JSON, it should open it in the text editor and offer a dump of all the syntax issues (if JSON.parse gives you all of them)

- OR, since you wanted a “paste JSON here” type, open it as one of those

“File modified externally,” probably an event that can be listened for, should do something.

- JsonDocument.onDidChangeContent does NOT do this (if you modify in a different editor)

it'd be SO FUNNY if certain editor widgets were just Monacos (i.e. micro instances of VS Code text editor)

- https://github.com/microsoft/monaco-editor
- https://stackoverflow.com/questions/61307979/how-to-import-npm-packages-in-vs-code-webview-extension-development

## EDITING

You have 2 options:

### Object-Backed Page

Inputs point(??? how to do effectively in J/TS ???) directly to a field of an object, which gets serialized on save.

- I suspect this will prevent or severely complicate adding & renaming keys; possibly also changing types

### Serialize HTML on Save

Saving traverses the page (specifically the container div) via DOM to build an object out of the keys & values.

- Perf. issues?
- You'll be tracking modifications - potential algo to limit what's updated?
- Type available from reading class
  - ALWAYS give fields their base class, no matter what special editor they get (presumably, only string gets this treatment)

## UX CONSIDERATIONS

- The raw "value" element should be hidden, not removed, when an editor is open...
  - So the save code doesn't have to attempt to read the input
- Editing elements should only appear after edit button is pressed
  - All editable text should act as its own edit button
  - When doing keyboard nav, only when it has focus
- **UNDO**
  - This will be real tough unless Custom Editor API can help out...
- When does a string go from input type=text to textarea?
  - When loaded, presence of newlines
  - While editing...?
    - Newline seamlessly changes it
    - Just always use a textarea
- TYPE: DateTime
  - an \<input\> is available IIRC
  - FEASIBLE: Save as ISO standard whatever (i.e. what that input gives)
    - CONFIG: Save as [date conversion string]
  - STRETCH: Detection on load
- TYPE: Color
  - CONFIG: Format saved as...
  - Detecting hex ain't hard
- TYPE: Import JSON Object/Array
  - Spawn a Monaco (STRETCH: not necessary) and write/paste the thing... hit a button and it's fed to the parser
- TYPE CONVERSIONS
  - Identify & warn data losses
  - Don't get carried away
  - Brainstorm what can convert to what. The Answer Might Surprise You!
    - Real zany things like object -> string serializing it (only w/ consent)
- ERROR HANDLING
  - Catch and display JSON handler's error(s)
  - VSCode toasts are probably fine for a lot of situations
- Simple Mode & View Mode
  - Hides any nonessential clutter you've added
  - Hides all editing features
- LARGE FILES
  - CONFIG: File size threshold to not open
  - On-Demand Mode: Only load the top level, collapsed, as editables... load more (also collapsed) when thing is unfolded. Implement as class "unloaded" [json content]
    - Activated when file is large

## STYLE

### Native VSCode UI

i.e. the settings screen

**_IS THIS ALREADY AVAILABLE IN THE EXTENSION API?_**

- TBD

**_IF NOT, DOES ANOTHER EXTENSION DO SOMETHING SIMILAR?_**

- Jupyter Notebooks are (SEEMINGLY) a natively styled custom editor. Is that editor truly in the extension or does it use something built in?

**_IF NOT, ARE YOU EVEN ALLOWED TO DO THIS?_**

- Pay close attention to VSCodium licensing

## CONFIGURABILITY

- Register hotkeys (duh)
- Save the file minified or pretty?
- Allowed Type Conversions:
  - Let Me Wipe Fields
  - One-Way/Jokes
  - Only Safe (i.e. number <-> stringed number)
  - None

## STRETCH GOALS

### Support Schema

Constrain all "new thing" buttons to what the schema allows

- Different "new thing" combobox limited to "name (type)"

OR (lazy) run a validator on save and complain about errors

### Support YAML, TOML, etc.

"JSON is a subset of YAML"

Constrained to what JS objects can serialize to & what the package you find supports. In this household we don't reinvent the wheel

- YAML may have sugar that gets lost?
- TOML smells like INI, which doesn't smoothly convert to JSON

### Good Keyboard Nav

Like writing YAML... maybe

### Live(ish?) Preview

True bidirectional sync would SUCK in every way,

HOWEVER a stripped down view-only mode could be a nice language feature to add, maybe even as a separate extension

- Viewer could perhaps be an on-build flag that packs in only the view mode? Some kind of #ifdef situation?

## IMPORTANT LINKS

- JSON spec: https://datatracker.ietf.org/doc/html/rfc8259#section-1.2 & https://ecma-international.org/publications-and-standards/standards/ecma-404/

## LICENSING TANGLE

So far, you are reusing code that is:

- MIT
