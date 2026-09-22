BEWARE - work in progress, not complete.

DSL based on .lua syntax and ideas as this is the language used for Minecraft, PZ, Roblox 'Luau' and love2D

### Events

#### When Custom Variable Changes


When Custom Variable Changes has outputs in order: Generic, Integer, String, Entity, GUID, Float, 3D Vector, Boolean, Integer List, String list, Entity list, GUID list, FLoat list, 3D vector List, Boolean List, Configuration ID, Prefab ID, Config ID list, Prefab ID list, Faction, Faction list, Dictionary, Dictionary List, Structure, Structure List

When Custom Variable Changes has to have Pre-Change Value and Post-Change Value set to a specific type, otherwise it doesn't work and ignores events from Custom Variables.

### Operations

#### Equal

    f.equal('0', '0')
Equal has 2 inputs that could be of 11 different types that are synced between input 1 and 2 those are: Generic (inherits), String, GUID, Entity, 3D Vector,  Faction, Integer, Float, Configuration ID, Prefab ID, Boolean. Output always Boolean.

Not sure if input IDs as a sequence are important or not.

### Lists

Lists: f.assemblyList(0) [nodes that store data. Game uses spatial placement of the Operation Node and node itself as an object to reference and grab wires from. IDE has to have an name for it for reference (assembly list)]

     local var_name: int list = {1,2,3,4} -- connects to get local variable [floating literal]
     list.name: int list = {1,2,3,4} -- creates a lone node with data on the graph
     list.name2: int list = {toInt(var_b), 2, var_c, toInt(2.7*HP)} -- is valid as long as everything converts to list type

![[img-1789642703574-398]]

List input could be: Generic (inherits connection), Int, String, Entity, GUID, Float, 3D Vector, Bool, Configuration ID, Prefab ID, Faction, Structure
Outputs: Generic List, Int list, String list, Entity list, GUID list, Float list, 3D Vector list, Bool list, Configuraion ID list, Prefab ID list, Faction list, Structure List

Changing input our output, changes the whole list Data type. Lists can only hold 1 data type. If 'Generic' on connection to a specific node with set data type it converts it into that data type.

Auto conversions: (1,2,3) = int list, {(1,3,4),(12,3.2,4)} = 3D Vector list, {1.2,2.3,4} = float list, {true, false, true} = bool list, {'me','you','coffee'} = string list
GUID, Config ID, Prefab ID, Faction are by default 'int lists' and has to be setup manually later to state that this is 'exotic type'
Entity and Structure rely on injection of data, so {entity.name1, entity.name2, entity.name3} = entity list, {struct.name1, struct.name2, struct.name3} = structure list

Max Length is 100. ID from 0 to 99. Every input in the list has a pin that could support math, variables, etc.

To get anything from the list we use node: f.getValFromList(list.name, ID as int) [it automatically adjusts towards data type specified by the list]

if we use something like this:

     list.name[1]

for nodes it will be converted into this:

     f.getValFromList(list.name, 1)

### Loops

Loops have 2 inputs and 2 outputs. Input 1 is execution in with Output 1 as iteration 'for each'. Input 2 is 'break loop' so during the loop it is possible to trigger 'f.breakLoop()' and stop the loop prematurely. When loop is broken or finished it fires Output 2 of 'Loop Complete' and code goes forward.

f.listIterationLoop()

Inputs in order: Generic (inherit), Boolean list, Entity list, Float list, GUID list, Integer list, String list, 3D Vector list, Configuration ID list, Prefab ID list, Faction list, Structure list
Output in order: Generic (inherit), Boolean, Entity, Float, GUID, Integer, String, 3D Vector, Configuration ID, Prefab ID, Faction, Structure

Those are 'for loops' that have lists as their input and they iterate every item 1 by 1 into 'Loop Body' execution out (Ex. turn on UI bar for all players on the field: f.getListOfPlayerEntitiesOnTheField() is a list of player entities and it goes 1 by 1 output into 'Iteration Value', so if there are 8 players, node will fire 8 time for each one of them so it is possible to turn on UI for every one of the players).


```
  for id in list.name do
    print(id) -- prints names 1 by 1
  end
```


f.finiteLoop()

Preset while loop with a counter. We can represent it with:

```
    for i from 0 to 2 do -- inputs only integers
      print(i) -- prints integers 0,1,2
    end
```

And we can reference 'i' as it is exists inside the loop and for the node itself it has output named 'Current' that is always an integer.
`for i from 0 to 0 do` it will run 1 time. It is possible to use f.breakLoop() to break it earlier, let's say if i = hp then f.breakLoop(). Or some setup that iterates through player HP and when HP 100, then f.breakLoop(), so we don't overheal the player.
