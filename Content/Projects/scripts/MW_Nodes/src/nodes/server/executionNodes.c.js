/**
 * EXECUTION_NODES - part 3
 */
export const EXECUTION_NODES_C = [
{
    "id": "exec_activate_disable_tab",
    "name": "Activate/Disable Tab",
    "category": "execution",
    "folder": "XXI. Tabs",
    "description": "Edit the Tab state by ID in the Target Entity's Tab Component.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Tab ID",
        "type": "int",
        "description": "Identifier for the Tab",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "If set to True, it is active and can be selected",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_disable_collision_trigger_source",
    "name": "Activate/Disable Collision Trigger Source",
    "category": "execution",
    "folder": "XXII. Collision Trigger Source",
    "description": "Edit the state of the Collision Trigger Source Component on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "If set to True, activates collision with Entities that carry Collision Trigger Components",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_change_player_s_current_class_level",
    "name": "Change Player's Current Class Level",
    "category": "execution",
    "folder": "XXIII. Class",
    "description": "Set the Player's current Class Level. If it exceeds the defined range, the change will not take effect.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Level",
        "type": "int",
        "description": "Edited Level",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_change_player_class",
    "name": "Change Player Class",
    "category": "execution",
    "folder": "XXIII. Class",
    "description": "Set the Player's current Class to the Class referenced by the Config ID and process the Player's existing skills.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Class Config ID",
        "type": "config_id",
        "description": "Class Identifier"
      },
      {
        "name": "Existing Skill Handling",
        "type": "enum",
        "description": "Clear All: Clear all existing skills. Preserve Unrelated Skills: Retain skills that are not defined in the default skill sets of either the previous or the new class"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_player_s_current_class_exp",
    "name": "Increase Player's Current Class EXP",
    "category": "execution",
    "folder": "XXIII. Class",
    "description": "Increase the Player's current Class EXP. Any excess beyond the maximum Level will not take effect.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "EXP",
        "type": "int",
        "description": "Amount of EXP to be increased",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_ui_control_group_in_control_group_library",
    "name": "Activate UI Control Group in Control Group Library",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "Activate the UI Control Groups stored as Custom Templates in the UI Control Group Library within the Target Player's Interface Layout.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "UI Control Group Index",
        "type": "int",
        "description": "Identifier for the UI Control Group",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_switch_current_interface_layout",
    "name": "Switch Current Interface Layout",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "Switch the Target Player's current Interface Layout via Layout ID.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Layout Index",
        "type": "int",
        "description": "Identifier for the UI Layout",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_ui_control_group_status",
    "name": "Set UI Control (Group) Status",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "Edit the state of the UI Control in the Target Player's Interface Layout by its UI Control ID.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "UI Control Group Index",
        "type": "int",
        "description": "Identifier for the UI Control",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Display Status",
        "type": "enum",
        "description": "Off: Invisible and logic not running. On: Visible and logic running normally. Hidden: Invisible and logic running normally"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_interface_control_group_from_control_group_library",
    "name": "Remove Interface Control Group From Control Group Library",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "Remove the UI Control Groups activated via `Activate UI Control Group in Control Group Library` from the Target Player's Interface Layout.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "UI Control Group Index",
        "type": "int",
        "description": "Identifier for the UI Control Group",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_play_ui_animation_on_control",
    "name": "Play UI Animation on Control",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "Plays the VFX asset mounted to this UI animation control in the Player Entity's Interface Layout. To hide or disable the VFX, use the `Set UI Control (Group) Status` node. If this node is executed multiple times, the VFX can be played multiple times as well.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Special Effect Control Index",
        "type": "int",
        "description": "Identifier for the UI Control/Fullscreen UI Control to Play the Animation on",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_refresh_notification_queue",
    "name": "Refresh Notification Queue",
    "category": "execution",
    "folder": "XXIV. UI Control Groups",
    "description": "The Notification Queue UI Control allows for the transmission of a given set of data to be displayed via a node graph. Once transmitted, the data will be displayed in the specified Notification Queue UI Control according to the graphic-text group template entered.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Notification Queue Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Notification Item ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Notification Queue Data",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_skill_cd_based_on_maximum_cd_percentage",
    "name": "Set Skill CD Based on Maximum CD Percentage",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Modify the skill in a character's skill slot by adjusting the percentage of the skill's maximum cooldown time.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to edited: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      },
      {
        "name": "Ratio Value",
        "type": "float",
        "description": "The revised actual cooldown time is: original cooldown time * ratio value",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Limit Maximum CD Time",
        "type": "bool",
        "description": "If set to True, the edited Cooldown cannot be less than the specified minimum value",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_initialize_character_skill",
    "name": "Initialize Character Skill",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Reset the Target Character's skills to those defined in the Class Template.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to initialize: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_skill_resource_amount",
    "name": "Set Skill Resource Amount",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Edit the Character's skill resource amount.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Resource Config ID",
        "type": "config_id",
        "description": "Skill Resource Identifier"
      },
      {
        "name": "Target Value",
        "type": "float",
        "description": "Edited value will be set to this input value",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_character_skill_cd",
    "name": "Set Character Skill CD",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Directly set the cooldown time of a specific skill slot on the target character to a specified value.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to edited: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      },
      {
        "name": "CD Time",
        "type": "float",
        "description": "Edited Cooldown will be set to this input value",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Limit Maximum CD Time",
        "type": "bool",
        "description": "If set to True, the edited Cooldown cannot be less than the specified minimum value",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_character_skill",
    "name": "Add Character Skill",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Add a skill to the specified Target Character's Skill Slot.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Config ID",
        "type": "config_id",
        "description": "Skill Identifier"
      },
      {
        "name": "Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to be added: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      },
      {
        "name": "Original Slot Skill Handling",
        "type": "enum",
        "description": "Destroy: Remove the original skill. Preserve Slot Binding: Retain the current slot binding. When the newly bound skill instance is removed, it is automatically displayed in that slot. Remove Slot Binding: The skill must be reassigned to the specified slot in order to be displayed in that slot"
      }
    ],
    "outputs": [
      {
        "name": "Switched Skill Instance ID",
        "type": "int"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_skill_resource_amount",
    "name": "Increase Skill Resource Amount",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Modifying the resource amount of a skill will add an increase to the current value; this increase can be a negative number.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Resource Config ID",
        "type": "config_id",
        "description": "Skill Resource Identifier"
      },
      {
        "name": "Increase Value",
        "type": "float",
        "description": "The modified value is: original value + increase value",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_character_skill_cd",
    "name": "Increase Character Skill CD",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Modifying the cooldown of a target character's skill slot will add an increase to the current cooldown time; this increase can be a negative number.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to be edited: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      },
      {
        "name": "CD Time Increase Value",
        "type": "float",
        "description": "The modified value is: original value + increase value",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Limit Maximum CD Time",
        "type": "bool",
        "description": "If set to True, the edited Cooldown cannot be less than the specified minimum value",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_delete_character_skill_by_slot",
    "name": "Delete Character Skill by Slot",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Delete the skill in the specified slot of the Target Character.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum",
        "description": "The Skill Slot to be deleted: Normal Attack, Skill 1-E, Skill 2-Q, Skill 3-R, Skill 4-T, or Custom Skill"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_delete_character_skill_by_id",
    "name": "Delete Character Skill by ID",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Iterate through and delete all skills with the specified Config ID across all of the Character's slots.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Config ID",
        "type": "config_id",
        "description": "Skill Identifier"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_bind_custom_skill_instance_to_specified_slot",
    "name": "Bind Custom Skill Instance to Specified Slot",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Bind the specified skill instance to the specified skill slot.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Instance ID",
        "type": "int",
        "description": "Identifier for the Skill Instance",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Skill Slot",
        "type": "enum"
      },
      {
        "name": "Original Slot Skill Handling",
        "type": "enum",
        "description": "Destroy: Remove the original skill. Preserve Slot Binding: Retain the current slot binding. When the newly bound skill instance is removed, it is automatically displayed in that slot. Remove Slot Binding: The skill must be reassigned to the specified slot in order to be displayed in that slot"
      }
    ],
    "outputs": [
      {
        "name": "Original Slot Skill Instance ID",
        "type": "int"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_unbind_skill_instance",
    "name": "Unbind Skill Instance",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Unbind the specified skill instance from the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Instance ID",
        "type": "int",
        "description": "Identifier for the Skill Instance",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_unbind_all_skill_instances_on_the_slot",
    "name": "Unbind all Skill Instances on the Slot",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Unbind all skill instances on the specified slot of the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Specified Slot",
        "type": "enum"
      }
    ],
    "outputs": [
      {
        "name": "Unbound Skill Instance ID List",
        "type": "int",
        "description": "List of skill instance IDs unbound from the slot"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_create_custom_skill_instance",
    "name": "Create Custom Skill Instance",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Create a skill instance from the specified config ID for the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Config ID",
        "type": "config_id",
        "description": "Skill Identifier"
      }
    ],
    "outputs": [
      {
        "name": "Skill Instance ID",
        "type": "int",
        "description": "Identifier for the Skill Instance"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_destroy_custom_skill_instance",
    "name": "Destroy Custom Skill Instance",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Destroy the specified skill instance on the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Instance ID",
        "type": "int",
        "description": "Identifier for the Skill Instance",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_cast_skill_from_specified_panel_slot",
    "name": "Cast Skill From Specified Panel Slot",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Cast the skill currently active in the specified skill slot on the Character Entity. This input works only if the skill is bound to a button and is currently active.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Slot",
        "type": "enum"
      },
      {
        "name": "Check Key Availability",
        "type": "bool",
        "description": "Yes: Cast only when the key is available. No: Cast even if the key is not available",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_cast_specified_skill_instance",
    "name": "Cast Specified Skill Instance",
    "category": "execution",
    "folder": "XXV. Skills",
    "description": "Cast the skill corresponding to the specified skill instance ID on the Character Entity. This input works only if the skill is bound to a button and is currently active.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "Active Character Entity"
      },
      {
        "name": "Skill Instance ID",
        "type": "int",
        "description": "Identifier for the Skill Instance",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Check Key Availability",
        "type": "bool",
        "description": "Yes: Cast only when the key is available. No: Cast even if the key is not available",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_adjust_player_background_music_volume",
    "name": "Adjust Player Background Music Volume",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Adjust Player Background Music Volume.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Volume",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_adjust_specified_sound_effect_player",
    "name": "Adjust Specified Sound Effect Player",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Adjust the volume and playback speed of the Sound Effect Player with the specified ID in the Sound Effect Player Component on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "SFX Player ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Volume",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Playback Speed",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_close_specified_sound_effect_player",
    "name": "Close Specified Sound Effect Player",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Disable the Sound Effect Player with the specified ID in the Sound Effect Player Component on the specified Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "SFX Player ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_start_pause_player_background_music",
    "name": "Start/Pause Player Background Music",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Edit the background music state for the specified Player.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Recover",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_start_pause_specified_sound_effect_player",
    "name": "Start/Pause Specified Sound Effect Player",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Edit the state of the Sound Effect Player with the specified ID in the Sound Effect Player Component on the Target Entity. This node is only active when the sound effect is set to loop playback. It does not take effect for sound effects configured for single-playback.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "SFX Player ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Recover",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_sound_effect_player",
    "name": "Add Sound Effect Player",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Dynamically add a Sound Effect Player. The Unit must have a Sound Effect Player Component.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Sound Effect Asset Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Volume",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Playback Speed",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Loop Playback",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Loop Interval Time",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "3D Sound Effect",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Range Radius",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Attenuation Mode",
        "type": "enum"
      },
      {
        "name": "Attachment Point Name",
        "type": "string",
        "defaultVal": "",
        "placeholder": "Attachment Point Name"
      },
      {
        "name": "Attachment Point Offset",
        "type": "vector3"
      }
    ],
    "outputs": [
      {
        "name": "SFX Player ID",
        "type": "int"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_player_plays_one_shot_2d_sound_effect",
    "name": "Player Plays One-Shot 2D Sound Effect",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Player plays a one-shot 2D Sound Effect.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Sound Effect Asset Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Volume",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Playback Speed",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_background_music",
    "name": "Set Player Background Music",
    "category": "execution",
    "folder": "XXVI. Sound Effects",
    "description": "Set player background music parameters.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Background Music Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Start Time",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "End Time",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Volume",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Loop Playback",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Loop Interval",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Playback Speed",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Enable Fade In/Out",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_clear_unit_tags_from_entity",
    "name": "Clear Unit Tags from Entity",
    "category": "execution",
    "folder": "XXVII. Unit Tags",
    "description": "Clear Unit Tags for the specified Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_unit_tag_to_entity",
    "name": "Add Unit Tag to Entity",
    "category": "execution",
    "folder": "XXVII. Unit Tags",
    "description": "Add Unit Tags to the specified Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Tag Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_unit_tag_from_entity",
    "name": "Remove Unit Tag from Entity",
    "category": "execution",
    "folder": "XXVII. Unit Tags",
    "description": "Remove Unit Tags from the specified Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Tag Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_taunt_target",
    "name": "Taunt Target",
    "category": "execution",
    "folder": "XXVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. Make the Taunter Entity taunt the specified Target Entity.",
    "inputs": [
      {
        "name": "Taunter Entity",
        "type": "entity"
      },
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_target_entity_from_aggro_list",
    "name": "Remove Target Entity From Aggro List",
    "category": "execution",
    "folder": "XXVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. Remove the Target Entity from the Aggro Owner's Aggro List; this may cause the target to leave battle.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Aggro Owner Entity",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  }
];
