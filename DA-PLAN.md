# DA PLAN...

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

## STYLE

### Native VSCode UI

i.e. the settings screen

**_IS THIS ALREADY AVAILABLE IN THE EXTENSION API?_**

- TBD

**_IF NOT, DOES ANOTHER EXTENSION DO SOMETHING SIMILAR?_**

- Jupyter Notebooks are (SEEMINGLY) a natively styled custom editor. Is that editor truly in the extension or does it use something built in?

**_IF NOT, ARE YOU EVEN ALLOWED TO DO THIS?_**

- Pay close attention to VSCodium licensing

## IMPORTANT LINKS

- JSON spec: https://datatracker.ietf.org/doc/html/rfc8259#section-1.2 & https://ecma-international.org/publications-and-standards/standards/ecma-404/
