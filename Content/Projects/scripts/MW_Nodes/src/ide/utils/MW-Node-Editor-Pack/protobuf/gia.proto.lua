--[[
  =============================================================================
  Miliastra Wonderland — Protobuf Schema & Node Graph Macro Engine
  gia.proto.lua
  -----------------------------------------------------------------------------
  This module defines the full Lua data structures, enumerations, type
  contracts, constructors, and AST manipulation helpers corresponding to
  gia.proto / gia.proto.ts for Miliastra Wonderland (.gia) visual script files.

  Pipeline Architecture:
    [Visual Nodes] <===> [.gia Binary] <===> [AST Table / JSON] <===> [Lua Mirror & Macros]
  =============================================================================
--]]

local GiaProto = {}

-- =============================================================================
-- 1. ENUMERATIONS & CONSTANTS (with bidirectional lookup)
-- =============================================================================

local function createEnum(name, tbl)
  local enum = {}
  local reverse = {}
  for k, v in pairs(tbl) do
    enum[k] = v
    reverse[v] = k
  end
  enum._reverse = reverse
  enum.toString = function(val) return reverse[val] or ("Unknown_" .. tostring(val)) end
  enum.fromString = function(str) return enum[str] end
  return setmetatable(enum, {
    __tostring = function() return "Enum(" .. name .. ")" end,
    __index = function(_, k)
      error(string.format("Invalid enum key '%s' in %s", tostring(k), name), 2)
    end
  })
end

--- Server-side variable types (VarType)
GiaProto.VarType = createEnum("VarType", {
  UnknownVar = 0,
  Entity = 1,
  GUID = 2,
  Integer = 3,
  Boolean = 4,
  Float = 5,
  String = 6,
  GUIDList = 7,
  IntegerList = 8,
  BooleanList = 9,
  FloatList = 10,
  StringList = 11,
  Vector = 12,
  EntityList = 13,
  EnumItem = 14,
  VectorList = 15,
  LocalVariable = 16,
  Faction = 17,
  Configuration = 20,
  Prefab = 21,
  ConfigurationList = 22,
  PrefabList = 23,
  FactionList = 24,
  Struct = 25,
  StructList = 26,
  Dictionary = 27,
  VariableSnapshot = 28,
})

--- Client-side variable types (ClientVarType)
GiaProto.ClientVarType = createEnum("ClientVarType", {
  UnknownVar_ = 0,
  Entity_ = 1,
  EntityList_ = 2,
  Integer_ = 3,
  IntegerList_ = 4,
  Boolean_ = 5,
  BooleanList_ = 6,
  Float_ = 7,
  FloatList_ = 8,
  String_ = 9,
  StringList_ = 10,
  Vector_ = 11,
  VectorList_ = 12,
  EnumItem_ = 13,
  GUID_ = 14,
  GUIDList_ = 15,
  Faction_ = 16,
  EnumList_ = 17,
  Configuration_ = 18,
  Prefab_ = 19,
  ConfigurationList_ = 20,
  PrefabList_ = 21,
  Structure_ = 22,
  StructureList_ = 23,
  Dictionary_ = 24,
  FactionList_ = 25,
})

--- VarBase value classes (VarBase.Class)
GiaProto.VarBaseClass = createEnum("VarBaseClass", {
  Unknown = 0,
  IdBase = 1,
  IntBase = 2,
  BoolBase = 3,
  FloatBase = 4,
  StringBase = 5,
  EnumBase = 6,
  VectorBase = 7,
  ConcreteBase = 10000,
  StructBase = 10001,
  ArrayBase = 10002,
  MapBase = 10003,
  ClientContainerMeta = 10006,
  MapPair = 10007,
})

--- Node pin index kinds (NodePin.Index.Kind)
GiaProto.NodePinIndexKind = createEnum("NodePinIndexKind", {
  Unknown = 0,
  InFlow = 1,
  OutFlow = 2,
  InParam = 3,
  OutParam = 4,
  ClientExecNode = 5,
  ClientSignal = 6,
})

--- GraphUnit Which discriminant
GiaProto.GraphUnitWhich = createEnum("GraphUnitWhich", {
  Unknown = 0,
  EntityNode = 9,
  BooleanFilter = 10,
  Skills = 11,
  CompositeGraph = 12,
  SendSignalComposite = 14,
  StatusNode = 22,
  ClassNode = 23,
  StructureDefinition = 29,
  ItemNode = 46,
  IntegerFilter = 47,
  CreationStatusDecision = 51,
  CreationSkill = 52,
  CreationStatus = 53,
  CharacterControlSkill = 64,
})

--- GraphUnit ID classes
GiaProto.GraphUnitIdClass = createEnum("GraphUnitIdClass", {
  Unknown1 = 0,
  Node = 1,
  Basic = 5,
  AffiliatedNode = 23,
})

--- GraphUnit ID types
GiaProto.GraphUnitIdType = createEnum("GraphUnitIdType", {
  ServerGraph = 0,
  ClientGraph = 3,
  StructureDefinition = 15,
})

--- NodeGraph ID classes
GiaProto.NodeGraphIdClass = createEnum("NodeGraphIdClass", {
  Unknown1 = 0,
  UserDefined = 10000,
  SystemDefined = 10001,
})

--- NodeGraph ID types
GiaProto.NodeGraphIdType = createEnum("NodeGraphIdType", {
  Unknown2 = 0,
  BasicNode = 20000,
  BooleanFilter = 20001,
  Skills = 20002,
  StatusNode = 20003,
  ClassNode = 20004,
  ItemNode = 20005,
  IntegerFilter = 20006,
  CreationStatusDecision = 20007,
  CreationSkill = 20008,
  CreationStatus = 20009,
  CharacterControlSkill = 20010,
})

--- NodeGraph ID kinds
GiaProto.NodeGraphIdKind = createEnum("NodeGraphIdKind", {
  Unknown3 = 0,
  NodeGraph = 21001,
  CompositeGraph = 21002,
  SysCall = 22000,
  SysGraph = 22001,
})

--- CompositeDef Type kinds
GiaProto.CompositeDefTypeKind = createEnum("CompositeDefTypeKind", {
  Unknown = 0,
  Composite = 1000,
  SendSignal = 1001,
  MonitorSignal = 1002,
  Assembly = 1003,
  Split = 1004,
  Modify = 1005,
})

--- VarBase ItemType ClassBase
GiaProto.VarBaseItemTypeClassBase = createEnum("VarBaseItemTypeClassBase", {
  Unknown = 0,
  Server = 1,
  Client = 2,
})

--- VarBase ItemType ServerType Kind
GiaProto.VarBaseItemTypeServerTypeKind = createEnum("VarBaseItemTypeServerTypeKind", {
  Normal = 0,
  Struct = 1,
  Pair = 2,
})

--- NodeProperty Type
GiaProto.NodePropertyType = createEnum("NodePropertyType", {
  Unknown = 0,
  Server = 20000,
  Filter = 20001,
  Skill = 20002,
  CreationStatusNode = 20007,
})

-- =============================================================================
-- 2. CONSTRUCTORS & FACTORY HELPERS
-- =============================================================================

--- Create a Root AST container
--- @param opts table?
--- @return table
function GiaProto.createRoot(opts)
  opts = opts or {}
  return {
    graph = opts.graph or GiaProto.createGraphUnit(),
    accessories = opts.accessories or {},
    filePath = opts.filePath or "",
    modeFlag = opts.modeFlag,
    gameVersion = opts.gameVersion or "6.3.0"
  }
end

--- Create a GraphUnit
--- @param opts table?
--- @return table
function GiaProto.createGraphUnit(opts)
  opts = opts or {}
  return {
    id = opts.id or {
      class = GiaProto.GraphUnitIdClass.Basic,
      type = GiaProto.GraphUnitIdType.ServerGraph,
      id = opts.unitId or 1
    },
    relatedIds = opts.relatedIds or {},
    name = opts.name or "Main Node Graph",
    which = opts.which or GiaProto.GraphUnitWhich.Skills,
    graph = opts.graph or {
      inner = {
        graph = GiaProto.createNodeGraph(opts.nodeGraphOpts)
      }
    },
    compositeDef = opts.compositeDef,
    structureDef = opts.structureDef
  }
end

--- Create a NodeGraph
--- @param opts table?
--- @return table
function GiaProto.createNodeGraph(opts)
  opts = opts or {}
  return {
    id = opts.id or {
      class = GiaProto.NodeGraphIdClass.UserDefined,
      type = GiaProto.NodeGraphIdType.Skills,
      kind = GiaProto.NodeGraphIdKind.NodeGraph,
      id = opts.graphId or 1
    },
    name = opts.name or "Node Graph",
    nodes = opts.nodes or {},
    compositePins = opts.compositePins or {},
    comments = opts.comments or {},
    graphValues = opts.graphValues or {},
    affiliations = opts.affiliations or {},
    entrySlotIndex = opts.entrySlotIndex,
    evaluationInterval = opts.evaluationInterval
  }
end

--- Create a GraphNode
--- @param opts table?
--- @return table
function GiaProto.createGraphNode(opts)
  opts = opts or {}
  return {
    nodeIndex = opts.nodeIndex or 0,
    genericId = opts.genericId or {
      class = GiaProto.NodeGraphIdClass.SystemDefined,
      type = GiaProto.NodePropertyType.Server,
      kind = GiaProto.NodeGraphIdKind.SysCall,
      nodeId = opts.nodeId or 0
    },
    concreteId = opts.concreteId,
    pins = opts.pins or {},
    x = opts.x or 0.0,
    y = opts.y or 0.0,
    comments = opts.comments,
    contextDeclaration = opts.contextDeclaration,
    signalVersion = opts.signalVersion,
    usingStruct = opts.usingStruct or {},
    statusNodeExtension = opts.statusNodeExtension
  }
end

--- Create a NodePin.Index
--- @param kind number|string
--- @param index number
--- @param nodeId number?
--- @return table
function GiaProto.createPinIndex(kind, index, nodeId)
  local kindNum = type(kind) == "string" and GiaProto.NodePinIndexKind[kind] or kind
  local pinIdx = {
    kind = kindNum or GiaProto.NodePinIndexKind.Unknown,
    index = index or 0
  }
  if nodeId then
    pinIdx.nodeId = { id = nodeId }
  end
  return pinIdx
end

--- Create a NodePin
--- @param opts table?
--- @return table
function GiaProto.createNodePin(opts)
  opts = opts or {}
  return {
    i1 = opts.i1 or GiaProto.createPinIndex(opts.kind1 or GiaProto.NodePinIndexKind.InFlow, opts.index1 or 0),
    i2 = opts.i2 or GiaProto.createPinIndex(opts.kind2 or GiaProto.NodePinIndexKind.InFlow, opts.index2 or 0),
    value = opts.value or GiaProto.createVarBase(GiaProto.VarType.Integer, 0),
    type = opts.type or GiaProto.VarType.Integer,
    connects = opts.connects or {},
    clientExecNode = opts.clientExecNode,
    compositePinIndex = opts.compositePinIndex
  }
end

--- Create a NodeConnection
--- @param targetNodeIndex number
--- @param targetPinIndex number
--- @param targetKind number|string?
--- @return table
function GiaProto.createConnection(targetNodeIndex, targetPinIndex, targetKind)
  local kindNum = type(targetKind) == "string" and GiaProto.NodePinIndexKind[targetKind] or (targetKind or GiaProto.NodePinIndexKind.InFlow)
  return {
    id = targetNodeIndex,
    connect = GiaProto.createPinIndex(kindNum, targetPinIndex),
    connect2 = GiaProto.createPinIndex(kindNum, targetPinIndex)
  }
end

--- Create a strongly typed VarBase
--- @param varType number|string
--- @param rawValue any
--- @param opts table?
--- @return table
function GiaProto.createVarBase(varType, rawValue, opts)
  opts = opts or {}
  local typeNum = type(varType) == "string" and GiaProto.VarType[varType] or varType

  local vb = {
    class = GiaProto.VarBaseClass.Unknown,
    alreadySetVal = opts.alreadySetVal ~= nil and opts.alreadySetVal or (rawValue ~= nil),
    itemType = opts.itemType or {
      classBase = GiaProto.VarBaseItemTypeClassBase.Server,
      type_server = {
        type = typeNum,
        kind = GiaProto.VarBaseItemTypeServerTypeKind.Normal
      }
    }
  }

  if typeNum == GiaProto.VarType.Integer or typeNum == GiaProto.VarType.Boolean then
    vb.class = GiaProto.VarBaseClass.IntBase
    vb.bInt = { val = (type(rawValue) == "boolean") and (rawValue and 1 or 0) or tonumber(rawValue or 0) }
  elseif typeNum == GiaProto.VarType.Float then
    vb.class = GiaProto.VarBaseClass.FloatBase
    vb.bFloat = { val = tonumber(rawValue or 0.0) }
  elseif typeNum == GiaProto.VarType.String then
    vb.class = GiaProto.VarBaseClass.StringBase
    vb.bString = { val = tostring(rawValue or "") }
  elseif typeNum == GiaProto.VarType.EnumItem then
    vb.class = GiaProto.VarBaseClass.EnumBase
    vb.bEnum = { val = tonumber(rawValue or 0) }
  elseif typeNum == GiaProto.VarType.Vector then
    vb.class = GiaProto.VarBaseClass.VectorBase
    local vec = rawValue or {}
    vb.bVector = {
      val = {
        x = tonumber(vec.x or vec[1] or 0),
        y = tonumber(vec.y or vec[2] or 0),
        z = tonumber(vec.z or vec[3] or 0)
      }
    }
  elseif typeNum == GiaProto.VarType.GUID or typeNum == GiaProto.VarType.Entity then
    vb.class = GiaProto.VarBaseClass.IdBase
    vb.bId = { val = tonumber(rawValue or 0) }
  elseif typeNum == GiaProto.VarType.Struct then
    vb.class = GiaProto.VarBaseClass.StructBase
    vb.bStruct = { items = rawValue or {} }
  elseif typeNum == GiaProto.VarType.Dictionary then
    vb.class = GiaProto.VarBaseClass.MapBase
    vb.bMap = { mapPairs = rawValue or {} }
  elseif (typeNum >= GiaProto.VarType.GUIDList and typeNum <= GiaProto.VarType.StringList)
      or typeNum == GiaProto.VarType.VectorList
      or typeNum == GiaProto.VarType.EntityList
      or typeNum == GiaProto.VarType.ConfigurationList
      or typeNum == GiaProto.VarType.PrefabList
      or typeNum == GiaProto.VarType.FactionList
      or typeNum == GiaProto.VarType.StructList then
    vb.class = GiaProto.VarBaseClass.ArrayBase
    vb.bArray = { entries = rawValue or {} }
  else
    vb.class = GiaProto.VarBaseClass.IntBase
    vb.bInt = { val = tonumber(rawValue or 0) }
  end

  return vb
end

--- Create a CompositeDef container (used by Signal & Composite accessory units)
--- @param opts table?
--- @return table
function GiaProto.createCompositeDef(opts)
  opts = opts or {}
  return {
    id = opts.id or {
      genericId = { class = 10001, type = 20000, kind = 22001, id = opts.genericId or 0 },
      concreteId = { class = 10001, type = 20000, kind = 22001, id = opts.concreteId or 0 },
      graphId = { class = 0, type = 0, kind = 0, id = 0 }
    },
    inflows = opts.inflows or {},
    outflows = opts.outflows or {},
    inputs = opts.inputs or {},
    outputs = opts.outputs or {},
    signalPins = opts.signalPins or {},
    type = opts.type or { kind = GiaProto.CompositeDefTypeKind.Composite },
    name = opts.name or "",
    description = opts.description or "",
    xxx = opts.xxx or 0,
    signalVersion = opts.signalVersion or 8
  }
end

--- Create a SignalPinDef
--- @param sigName string
--- @param sigIndex number?
--- @param pinIndex number?
--- @return table
function GiaProto.createSignalPinDef(sigName, sigIndex, pinIndex)
  return {
    name = "Signal Name",
    visible = true,
    value = GiaProto.createVarBase(GiaProto.VarType.String, sigName),
    clientExecNode = { kind = GiaProto.NodePinIndexKind.ClientSignal, index = sigIndex or 1 },
    pinIndex = pinIndex or 0
  }
end

-- =============================================================================
-- 3. AST QUERY & MACRO HELPERS (Node Graph Transformations)
-- =============================================================================

--- Find a node by nodeIndex
--- @param graph table NodeGraph table
--- @param nodeIndex number
--- @return table? GraphNode
function GiaProto.findNodeByIndex(graph, nodeIndex)
  if not graph or not graph.nodes then return nil end
  for _, node in ipairs(graph.nodes) do
    if node.nodeIndex == nodeIndex then
      return node
    end
  end
  return nil
end

--- Find all nodes with a given generic template nodeId
--- @param graph table NodeGraph table
--- @param nodeId number
--- @return table List of GraphNode
function GiaProto.findNodesByGenericId(graph, nodeId)
  local res = {}
  if not graph or not graph.nodes then return res end
  for _, node in ipairs(graph.nodes) do
    if node.genericId and node.genericId.nodeId == nodeId then
      table.insert(res, node)
    end
  end
  return res
end

--- Get all pins of a specific kind on a node
--- @param node table GraphNode
--- @param kind number|string
--- @return table List of NodePin
function GiaProto.findPinsByKind(node, kind)
  local res = {}
  if not node or not node.pins then return res end
  local kindNum = type(kind) == "string" and GiaProto.NodePinIndexKind[kind] or kind
  for _, pin in ipairs(node.pins) do
    if pin.i1 and pin.i1.kind == kindNum then
      table.insert(res, pin)
    end
  end
  return res
end

--- Extract the raw Lua/JS value from a VarBase container
--- @param vb table VarBase
--- @return any
function GiaProto.getVarBaseValue(vb)
  if not vb then return nil end
  if vb.bString then return vb.bString.val end
  if vb.bInt then return vb.bInt.val end
  if vb.bFloat then return vb.bFloat.val end
  if vb.bEnum then return vb.bEnum.val end
  if vb.bId then return vb.bId.val end
  if vb.bVector then return vb.bVector.val end
  if vb.bStruct then return vb.bStruct.items end
  if vb.bArray then return vb.bArray.entries end
  if vb.bMap then return vb.bMap.mapPairs end
  return nil
end

--- Connect an outflow/outparam pin to an inflow/inparam pin
--- @param fromNode table GraphNode
--- @param fromPinIndex number
--- @param toNode table GraphNode
--- @param toPinIndex number
--- @param targetKind number|string?
function GiaProto.connectPins(fromNode, fromPinIndex, toNode, toPinIndex, targetKind)
  if not fromNode or not fromNode.pins then return end
  local pin = fromNode.pins[fromPinIndex + 1] -- Lua 1-indexed
  if not pin then return end
  pin.connects = pin.connects or {}
  table.insert(pin.connects, GiaProto.createConnection(toNode.nodeIndex, toPinIndex, targetKind))
end

--- Extract the signal name registered in a CompositeDef or GraphNode
--- @param unitOrNode table
--- @return string
function GiaProto.getSignalName(unitOrNode)
  if not unitOrNode then return "" end

  -- Check compositeDef inside GraphUnit
  local cDef = unitOrNode.compositeDef and unitOrNode.compositeDef.inner and unitOrNode.compositeDef.inner.def
  if cDef then
    if cDef.type and cDef.type.monitorSignalRef and cDef.type.monitorSignalRef.name then
      return cDef.type.monitorSignalRef.name
    end
    if cDef.type and cDef.type.sendSignalRef and cDef.type.sendSignalRef.name then
      return cDef.type.sendSignalRef.name
    end
    if cDef.signalPins then
      for _, sp in ipairs(cDef.signalPins) do
        if sp.name == "Signal Name" and sp.value and sp.value.bString then
          return sp.value.bString.val
        end
      end
    end
  end

  -- Check pins inside GraphNode
  if unitOrNode.pins then
    for _, p in ipairs(unitOrNode.pins) do
      if p.value and p.value.bString and p.value.bString.val and #p.value.bString.val > 0 then
        return p.value.bString.val
      end
    end
  end

  return ""
end

return GiaProto
