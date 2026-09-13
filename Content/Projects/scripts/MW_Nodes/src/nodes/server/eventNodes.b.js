/**
 * EVENT_NODES - part 2
 */
export const EVENT_NODES_B = [
{
    "id": "event_when_creation_enters_combat",
    "name": "When Creation Enters Combat",
    "category": "event",
    "folder": "XV. Creations",
    "description": "Only effective in Classic Aggro Mode. This event is triggered when a Creation enters battle.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_creation_leaves_combat",
    "name": "When Creation Leaves Combat",
    "category": "event",
    "folder": "XV. Creations",
    "description": "Only effective in Classic Aggro Mode. This event is triggered when a Creation leaves battle.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_class_level_changes",
    "name": "When Player Class Level Changes",
    "category": "event",
    "folder": "XVI. Classes",
    "description": "This event is triggered when a Player's Class Level changes and is sent to the corresponding Player. It can be received in that Class's Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Pre-Change Level",
        "type": "int"
      },
      {
        "name": "Post-Change Level",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_class_changes",
    "name": "When Player Class Changes",
    "category": "event",
    "folder": "XVI. Classes",
    "description": "This event is triggered when a Player's Class changes and is sent to the corresponding Player. It can be received in the Node Graph of the new Class.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Pre-Modification Class Config ID",
        "type": "config_id"
      },
      {
        "name": "Post-Modification Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_class_is_removed",
    "name": "When Player Class Is Removed",
    "category": "event",
    "folder": "XVI. Classes",
    "description": "This event is triggered when a Player's Class is removed and sent to the corresponding Player. It can be received in the Node Graph of the previous Class.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Pre-Modification Class Config ID",
        "type": "config_id"
      },
      {
        "name": "Post-Modification Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_skill_node_is_called",
    "name": "When Skill Node Is Called",
    "category": "event",
    "folder": "XVII. Skills",
    "description": "This event is triggered by the [Notify Server Node Graph] Node in the Skill Node Graph. Up to three strings can be passed in.",
    "inputs": [],
    "outputs": [
      {
        "name": "Caller Entity",
        "type": "entity"
      },
      {
        "name": "Caller GUID",
        "type": "guid"
      },
      {
        "name": "Parameter 1",
        "type": "string"
      },
      {
        "name": "Parameter 2",
        "type": "string"
      },
      {
        "name": "Parameter 3",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_aggro_target_changes",
    "name": "When Aggro Target Changes",
    "category": "event",
    "folder": "XVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. This event is triggered when the Aggro Target changes. This event can also be triggered when entering or leaving battle.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Pre-Change Aggro Target",
        "type": "entity"
      },
      {
        "name": "Post-Change Aggro Target",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_self_enters_combat",
    "name": "When Self Enters Combat",
    "category": "event",
    "folder": "XVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. This event is triggered when the Entity itself enters battle.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_self_leaves_combat",
    "name": "When Self Leaves Combat",
    "category": "event",
    "folder": "XVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. This event is triggered when the Entity itself leaves battle.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_monitor_signal",
    "name": "Monitor Signal",
    "category": "event",
    "folder": "XIX. Signals",
    "description": "Monitors Signal trigger events defined in the Signal Manager. The Signal name to monitor must be selected first.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Signal Source Entity",
        "type": "entity",
        "description": "The Entity that sent this signal using the Send Signal node"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_deck_selector_is_complete",
    "name": "When Deck Selector Is Complete",
    "category": "event",
    "folder": "XX. Deck Selector",
    "description": "This event is triggered on the Player's Node Graph when the Player completes the Deck Selector, or when it is forcibly closed due to time constraints. The output parameters report the Deck Selector's result and the corresponding reason.",
    "inputs": [],
    "outputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Selection Result List",
        "type": "int",
        "description": "When a selection interaction is triggered, valid selection results are returned as this output parameter, and the completion reason is Completed by Player<br>When a Full Refresh pop-up selection is triggered, the complete selection result list is returned as this output parameter, and the completion reason is Refresh All<br>When a Fixed-Quantity Refresh pop-up selection is triggered, valid selection results are returned as this output parameter, and the completion reason is Fixed-Quantity Refresh<br>When the Deck Selector times out with no interaction, the default selection is returned is returned as this output parameter, and the completion reason is Timeout<br>When Allow Discard Selection is enabled and the Deck Selector is closed by the player, the default selection is returned as this output parameter, and the completion reason is Closed Manually<br>When the Deck Selector is closed via the Node Graph, the default selection is returned as this output parameter, and the completion reason is Closed by Node Graph"
      },
      {
        "name": "Completion Reason",
        "type": "enum",
        "description": "Six reason enumerations<br>Completed by Player, Refresh All, Fixed-Quantity Refresh, Timeout, Closed Manually, Closed by Node Graph"
      },
      {
        "name": "Deck Selector Index",
        "type": "int",
        "description": "Referenced Deck Selector ID"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_text_bubble_is_completed",
    "name": "When Text Bubble Is Completed",
    "category": "event",
    "folder": "XXI. Text Bubbles",
    "description": "This event can only be mounted by Text Bubble Components and is received by the Entity's Node Graph that completed the dialogue. Completion refers to when the final line of dialogue has finished playing.",
    "inputs": [],
    "outputs": [
      {
        "name": "Bubble Owner Entity",
        "type": "entity",
        "description": "Runtime Entity with the Text Bubble component mounted"
      },
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Target Character of the current Bubble dialogue"
      },
      {
        "name": "Text Bubble Configuration ID",
        "type": "config_id",
        "description": "Currently active Text Bubble Config ID"
      },
      {
        "name": "Text Bubble Completion Count",
        "type": "int",
        "description": "Number of times the currently active Text Bubble has been fully played for this dialogue Character"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_selling_inventory_items_in_the_shop",
    "name": "When Selling Inventory Items in the Shop",
    "category": "event",
    "folder": "XXII. Shop",
    "description": "This event is triggered when Inventory items are sold in the Shop. The Owner of the Shop Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Shop Owner",
        "type": "entity"
      },
      {
        "name": "Shop Owner GUID",
        "type": "guid"
      },
      {
        "name": "Buyer Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Purchase Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_custom_shop_item_is_sold",
    "name": "When Custom Shop Item Is Sold",
    "category": "event",
    "folder": "XXII. Shop",
    "description": "This event is triggered when Custom items are sold in the Shop. The Owner of the Shop Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Shop Owner",
        "type": "entity"
      },
      {
        "name": "Shop Owner GUID",
        "type": "guid"
      },
      {
        "name": "Buyer Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int"
      },
      {
        "name": "Shop Item ID",
        "type": "int"
      },
      {
        "name": "Purchase Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_selling_items_to_the_shop",
    "name": "When selling items to the shop",
    "category": "event",
    "folder": "XXII. Shop",
    "description": "This event is triggered when items are purchased by the Shop. The Owner of the Shop Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Shop Owner",
        "type": "entity"
      },
      {
        "name": "Shop Owner GUID",
        "type": "guid"
      },
      {
        "name": "Seller Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int"
      },
      {
        "name": "Purchase Item Dictionary",
        "type": "dict"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_is_equipped",
    "name": "When Equipment Is Equipped",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "This event is triggered when Equipment is equipped. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Equipment Holder Entity",
        "type": "entity"
      },
      {
        "name": "Equipment Holder GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_is_unequipped",
    "name": "When Equipment Is Unequipped",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "This event is triggered when Equipment is unequipped. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Equipment Owner Entity",
        "type": "entity"
      },
      {
        "name": "Equipment Owner GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_is_initialized",
    "name": "When Equipment Is Initialized",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "When Equipment is first obtained and enters the Inventory, it is initialized. The event's output parameters return the unique ID of the Equipment instance. Use this ID to edit the Equipment dynamically. The Owner of the Equipment will receive this event. Configure this in the Item Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Equipment Owner",
        "type": "entity"
      },
      {
        "name": "Equipment Owner GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_affix_value_changes",
    "name": "When Equipment Affix Value Changes",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "This event is triggered when Equipment Affix values change. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Equipment Owner",
        "type": "entity"
      },
      {
        "name": "Equipment Owner GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index",
        "type": "int"
      },
      {
        "name": "Affix ID",
        "type": "int",
        "description": "The corresponding ID of this Entry within the Equipment Affixes"
      },
      {
        "name": "Pre-Change Value",
        "type": "float"
      },
      {
        "name": "Post-Change Value",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_is_purchased",
    "name": "When Equipment is purchased",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "The Inventory Owner Entity receives this event when it purchases equipment. This node is triggered only by item exchanges in the Inventory Shop. Custom shops do not trigger it. The Item Node Graph bound to the purchased equipment also receives this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Purchasing Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Purchasing Inventory Owner GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index List",
        "type": "int",
        "description": "List of Indices of the Purchased Equipment"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_equipment_is_sold",
    "name": "When Equipment is sold",
    "category": "event",
    "folder": "XXIII. Equipment",
    "description": "The Inventory Owner Entity receives this event when it sells equipment. This node is triggered only by item exchanges in the Inventory Shop. Custom shops do not trigger it. The Item Node Graph bound to the purchased equipment also receives this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Purchasing Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Purchasing Inventory Owner GUID",
        "type": "guid"
      },
      {
        "name": "Equipment Index List",
        "type": "int",
        "description": "List of Indices of the Sold Equipment"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_item_is_lost_from_inventory",
    "name": "When Item Is Lost From Inventory",
    "category": "event",
    "folder": "XXIV. Items",
    "description": "This event is triggered when an Item is removed from the Inventory (its quantity becomes 0). The Owner of the Inventory Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Item Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Owner GUID",
        "type": "guid"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Quantity Lost",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_the_quantity_of_inventory_item_changes",
    "name": "When the Quantity of Inventory Item Changes",
    "category": "event",
    "folder": "XXIV. Items",
    "description": "This event is triggered when the quantity of Items in the Inventory changes. The Owner of the Inventory Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Item Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Owner GUID",
        "type": "guid"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Pre-Change Quantity",
        "type": "int"
      },
      {
        "name": "Post-Change Quantity",
        "type": "int"
      },
      {
        "name": "Reason for Change",
        "type": "enum"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_item_added",
    "name": "When Item Is Added to Inventory",
    "category": "event",
    "folder": "XXIV. Items",
    "description": "This event is triggered when a new Item is added to the Inventory. The Owner of the Inventory Component will receive it. This event is not triggered by quantity-only changes.",
    "inputs": [],
    "outputs": [
      {
        "name": "Item Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Owner GUID",
        "type": "guid"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Quantity Obtained",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_the_quantity_of_inventory_currency_changes",
    "name": "When the Quantity of Inventory Currency Changes",
    "category": "event",
    "folder": "XXIV. Items",
    "description": "This event is triggered when the amount of Inventory Currency changes. The Owner of the Inventory Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Currency Owner Entity",
        "type": "entity"
      },
      {
        "name": "Currency Owner GUID",
        "type": "guid"
      },
      {
        "name": "Currency Config ID",
        "type": "config_id"
      },
      {
        "name": "Currency Change Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_items_in_the_inventory_are_used",
    "name": "When Items in the Inventory Are Used",
    "category": "event",
    "folder": "XXIV. Items",
    "description": "This event is triggered when an Item in the Inventory is used. The Owner of the Inventory Component will receive it.",
    "inputs": [],
    "outputs": [
      {
        "name": "Item Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Owner GUID",
        "type": "guid"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Amount to Use",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_creation_reaches_patrol_waypoint",
    "name": "When Creation Reaches Patrol Waypoint",
    "category": "event",
    "folder": "XXV. Creation Patrol",
    "description": "When the Send Node Graph Event on Arrival option is enabled for a waypoint in the Patrol template, a Node Graph Event is triggered once the specified conditions are met. This Node Graph Event can only be received by the creation's node graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Creation Entity",
        "type": "entity",
        "description": "Runtime Creation Entity"
      },
      {
        "name": "Creation GUID",
        "type": "guid",
        "description": "The GUID of the Creation. If it was not an initially placed Creation, the output is empty"
      },
      {
        "name": "Current Patrol Template ID",
        "type": "int",
        "description": "The Patrol Template ID currently active on this Creation"
      },
      {
        "name": "Current Path Index",
        "type": "int",
        "description": "The Path ID referenced by the Creation's currently active Patrol Template"
      },
      {
        "name": "Current Reached Waypoint ID",
        "type": "int",
        "description": "The Waypoint ID the Creation has currently reached"
      },
      {
        "name": "Next Waypoint ID",
        "type": "int",
        "description": "The Waypoint ID the Creation will move to next"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_complex_creation_preset_status_changes",
    "name": "When Complex Creation Preset Status Changes",
    "category": "event",
    "folder": "XXVI. Creation Preset Status",
    "description": "This event is triggered when the preset state of a complex creation is changed using the \"Set the preset status value of the complex creation\" node (the modified and unmodified values must be different for this event to trigger). This node graph event can only be received by the node graph of the complex creation.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Complex Creation Entity"
      },
      {
        "name": "Event Source Entity GUID",
        "type": "guid",
        "description": "Complex Creation GUID"
      },
      {
        "name": "Preset Status Index",
        "type": "int"
      },
      {
        "name": "Pre-Change Value",
        "type": "int"
      },
      {
        "name": "Post-Change Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_floating_page_triggered",
    "name": "When Floating Interaction Page is Triggered",
    "category": "event",
    "folder": "XXVII. Floating Interaction Page",
    "description": "When the \"Return to Server Event\" option is enabled for a tab or single-choice window, confirming the interaction will trigger this event on the corresponding Player Entity's Server Node Graph. When the player selects a Tab/Single-Choice Panel: The Interactive Item Index is the index of the corresponding Tab/Single-Choice Panel, the List Index is the index of the corresponding Tab/Single-Choice Panel, and the Selected List Item is the index of the currently clicked item in the corresponding Tab/Single-Choice Panel. When the player clicks a button that has a Tab/Single-Choice Panel monitor configured: The Interactive Item Index is the index of the corresponding Tab/Single-Choice Panel, the List Index is the list of indices of all Tab/Single-Choice Panels associated with the button, and the Selected List Item is the list of indices of the currently clicked items in the corresponding Tab/Single-Choice Panels. After the interaction is confirmed, the corresponding player's server node graph will also receive this event for the following elements configured in the Floating Interaction Page: Interaction Page Close Button, Interaction Button, Item Display, Custom Button, and Custom Switch.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Player GUID",
        "type": "guid",
        "description": "GUID of the Active Player Entity"
      },
      {
        "name": "Floating Interaction Page Index",
        "type": "int",
        "description": "Unique Identifier for the Floating Interaction Page"
      },
      {
        "name": "Interactive Item Index",
        "type": "int",
        "description": "Index of the control that triggered this event"
      },
      {
        "name": "List Index",
        "type": "int",
        "description": "List of indices for the tabs or single-choice windows. Each List Index output parameter corresponds to a Selected List Item output parameter"
      },
      {
        "name": "Selected List Item",
        "type": "int",
        "description": "Each tab or single-choice window can have at most one selected item. Each Selected List Item output parameter corresponds to a List Index output parameter"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_leaves_control_motion_device",
    "name": "When Player Leaves Control Motion Device",
    "category": "event",
    "folder": "XXVIII. Control Motion Device",
    "description": "Triggered when the player exits the Motion Device. The player will automatically exit the Motion Device when they become controlled or are teleported.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Leave Control Motion Device Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_follows_control_motion_device",
    "name": "When Player Follows Control Motion Device",
    "category": "event",
    "folder": "XXVIII. Control Motion Device",
    "description": "Triggered when the player follows the Control Motion Device.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Follow Control Motion Device Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_s_activated_control_motion_device_list_changes",
    "name": "When Player's Activated Control Motion Device List Changes",
    "category": "event",
    "folder": "XXVIII. Control Motion Device",
    "description": "Triggered when the player follows the Control Motion Device.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Old Control Motion Device Entity List",
        "type": "entity"
      },
      {
        "name": "Current Activated Control Motion Device Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  }
];
