/**
 * EXECUTION_NODES - part 2
 */
export const EXECUTION_NODES_B = [
{
    "id": "exec_activate_disable_extra_collision",
    "name": "Activate/Disable Extra Collision",
    "category": "execution",
    "folder": "IX. Collision",
    "description": "Edit data in the Entity's Extra Collision Component to enable/disable Extra Collision.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Extra Collision ID",
        "type": "int",
        "description": "Identifier for this Extra Collision",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_activate_disable_extra_collision_climbability",
    "name": "Activate/Disable Extra Collision Climbability",
    "category": "execution",
    "folder": "IX. Collision",
    "description": "Edit the Climbability of the Entity's Extra Collision Component.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Extra Collision ID",
        "type": "int",
        "description": "Identifier for this Extra Collision",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_activate_disable_native_collision",
    "name": "Activate/Disable Native Collision",
    "category": "execution",
    "folder": "IX. Collision",
    "description": "Edit the Entity's Native Collision.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_activate_disable_native_collision_climbability",
    "name": "Activate/Disable Native Collision Climbability",
    "category": "execution",
    "folder": "IX. Collision",
    "description": "Edit the Climbability of the Entity's Native Collision.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_activate_disable_collision_trigger",
    "name": "Activate/Disable Collision Trigger",
    "category": "execution",
    "folder": "X. Collision Triggers",
    "description": "Edit the Collision Trigger Component data to Activate/Disable the Trigger at the specified ID.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Trigger ID",
        "type": "int",
        "description": "Identifier for this Collision Trigger",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_initiate_attack",
    "name": "Initiate Attack",
    "category": "execution",
    "folder": "XI. Combat",
    "description": "Make the specified Entity initiate an attack. The Entity that uses this node must have the corresponding Ability Unit configured. There are two usage modes: When the Ability Unit is `Hitbox Attack`, it executes a hitbox attack centered on the Target Entity's Location. When the Ability Unit is `Direct Attack`, it directly attacks the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Depending on the Ability Unit, this can be treated either as the reference target for the Hitbox Location or as the attack target"
      },
      {
        "name": "Damage Coefficient",
        "type": "float",
        "description": "The coefficient applied to the damage dealt by this attack",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Damage Increment",
        "type": "float",
        "description": "The incremental damage applied by this attack",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Location Offset",
        "type": "vector3",
        "description": "When using Hitbox Attack, determines the Hitbox offset. When using Direct Attack, determines the hit-detection location for the attack and thus where on-hit special effects are created"
      },
      {
        "name": "Rotation Offset",
        "type": "vector3",
        "description": "When using Hitbox Attack, determines the Hitbox rotation. When using Direct Attack, determines the hit-detection location for the attack and thus the rotation used for on-hit effects"
      },
      {
        "name": "Ability Unit",
        "type": "string",
        "description": "Referenced Ability Unit. Must be configured on the entity associated with this Node Graph",
        "defaultVal": "",
        "placeholder": "Ability Unit"
      },
      {
        "name": "Overwrite Ability Unit Config",
        "type": "bool",
        "description": "When set to True, the four parameters — Damage Coefficient, Damage Increment, Location Offset, and Rotation Offset — overwrite parameters of the same name in the Ability Unit. When set to False, the Ability Unit's original configuration is used",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Initiator Entity",
        "type": "entity",
        "description": "Determines the Initiator Entity for this attack. Defaults to the Entity associated with this Node Graph. Affects which attacker is identified in events such as On Hit and When Attacked"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_recover_hp",
    "name": "Recover HP",
    "category": "execution",
    "folder": "XI. Combat",
    "description": "Restore HP to the specified Target Entity via an Ability Unit.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Target of HP restoration"
      },
      {
        "name": "Recovery Amount",
        "type": "float",
        "description": "The amount of HP restored in this healing instance",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Ability Unit",
        "type": "string",
        "description": "Referenced Ability Unit. Must be configured on the entity associated with this Node Graph",
        "defaultVal": "",
        "placeholder": "Ability Unit"
      },
      {
        "name": "Overwrite Ability Unit Config",
        "type": "bool",
        "description": "When set to True, the Recovery Amount overwrites the parameter of the same name in the Ability Unit. When set to False, the Ability Unit's original configuration is used",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Recover Initiator Entity",
        "type": "entity",
        "description": "Determines the Initiator Entity of this healing action. Defaults to the Entity associated with this Node Graph. Affects healer identification in events such as When HP Is Recovered and When Initiating HP Recovery"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_hp_loss",
    "name": "HP Loss",
    "category": "execution",
    "folder": "XI. Combat",
    "description": "Directly cause the specified target to lose HP. Losing HP is not an attack, so it does not trigger attack-related events.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Target that loses HP"
      },
      {
        "name": "HP Loss",
        "type": "float",
        "description": "The amount of HP lost in this instance",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Lethal",
        "type": "bool",
        "description": "If set to False, this HP loss will leave the Target with at least 1 HP remaining",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Can be blocked by invincibility",
        "type": "bool",
        "description": "If set to True, and the Target is set to Invincible via Unit Status, HP loss has no effect",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Can be Blocked by Locked HP?",
        "type": "bool",
        "description": "If set to True, and the Target's HP is locked via Unit Status, HP loss has no effect",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Damage Pop-Up Type",
        "type": "enum",
        "description": "No Pop-Up / Normal Pop-Up / CRIT Hit Pop-Up"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_recover_hp_directly",
    "name": "Recover HP Directly",
    "category": "execution",
    "folder": "XI. Combat",
    "description": "Directly restore HP to the specified Target Entity. Unlike `Recover HP`, this node does not require an Ability Unit.",
    "inputs": [
      {
        "name": "Recover Initiator Entity",
        "type": "entity",
        "description": "The Entity that initiates healing"
      },
      {
        "name": "Recover Target Entity",
        "type": "entity",
        "description": "The Target Entity to be healed"
      },
      {
        "name": "Recovery Amount",
        "type": "float",
        "description": "The amount of HP restored in this healing instance",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Ignore Recovery Amount Adjustment",
        "type": "bool",
        "description": "If set to True, this healing amount is not affected by the Target's Unit Status effects that adjust healing",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Aggro Generation Multiplier",
        "type": "float",
        "description": "The Aggro generated by this healing, expressed as a multiplier. Only applicable when using Custom Aggro Mode",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Aggro Generation Increment",
        "type": "float",
        "description": "The Aggro generated by this healing, expressed as an incremental value. Only applicable when using Custom Aggro Mode",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Healing Tag List",
        "type": "string",
        "description": "The list of tags associated with this healing action. These can be accessed in the When HP Is Recovered and When Initiating HP Recovery events to identify a specific healing action",
        "defaultVal": "",
        "placeholder": "Healing Tag List"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_recover_basic_motion_device",
    "name": "Recover Basic Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Resume a paused Basic Motion Device on the Target Entity. The Target Entity must have the Basic Motion Device Component.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_fixed_point_motion_device",
    "name": "Activate Fixed-Point Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Dynamically add a Fixed-Point Basic Motion Device to the Target Entity during Stage runtime.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      },
      {
        "name": "Movement Mode",
        "type": "enum"
      },
      {
        "name": "Movement SPD",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Target Location",
        "type": "vector3",
        "description": "Absolute Location"
      },
      {
        "name": "Target Rotation",
        "type": "vector3",
        "description": "Absolute Rotation"
      },
      {
        "name": "Lock Rotation",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Movement Time",
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
    "id": "exec_activate_basic_motion_device",
    "name": "Activate Basic Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Activate a Basic Motion Device configured within the Target Entity's Basic Motion Device Component.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_target_oriented_rotation_based_motion_device",
    "name": "Add Target-Oriented Rotation-Based Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Dynamically add a Basic Motion Device with Target-Oriented Rotation to the Target Entity during Stage runtime.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      },
      {
        "name": "Motion Device Duration",
        "type": "float",
        "description": "The duration for which this motion device remains active",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Target Angle",
        "type": "vector3",
        "description": "Absolute Angle"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_uniform_basic_linear_motion_device",
    "name": "Add Uniform Basic Linear Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Dynamically add a Basic Motion Device with Uniform Linear Motion at runtime.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      },
      {
        "name": "Motion Device Duration",
        "type": "float",
        "description": "The duration for which this motion device remains active",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Velocity Vector",
        "type": "vector3",
        "description": "Determines the magnitude and direction of the velocity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_uniform_basic_rotation_based_motion_device",
    "name": "Add Uniform Basic Rotation-Based Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Dynamically add a Basic Motion Device with Uniform Rotation at runtime.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      },
      {
        "name": "Motion Device Duration",
        "type": "float",
        "description": "The duration for which this motion device remains active",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Angular Velocity (°/s)",
        "type": "float",
        "description": "Angular Velocity Magnitude",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Rotation Axis Orientation",
        "type": "vector3",
        "description": "Relative Orientation"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_stop_and_delete_basic_motion_device",
    "name": "Stop and Delete Basic Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Stop and delete a running Motion Device.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      },
      {
        "name": "Stop All Basic Motion Devices",
        "type": "bool",
        "description": "If set to True, stops all Basic Motion Devices on this Entity. If set to False, stops only the Motion Device whose name matches the specified Motion Device",
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
    "id": "exec_pause_basic_motion_device",
    "name": "Pause Basic Motion Device",
    "category": "execution",
    "folder": "XII. Motion Devices",
    "description": "Pause a running Motion Device. The Resume Motion Device node can then be used to resume it.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Motion Device Name",
        "type": "string",
        "description": "Identifier for this motion device",
        "defaultVal": "",
        "placeholder": "Motion Device Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_disable_follow_motion_device",
    "name": "Activate/Disable Follow Motion Device",
    "category": "execution",
    "folder": "XIII. Follow Motion Device",
    "description": "Enable/Disable the Follow Motion Device logic on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that a Follow Motion Device is attached to"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to activate",
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
    "id": "exec_switch_follow_motion_device_target_by_guid",
    "name": "Switch Follow Motion Device Target by GUID",
    "category": "execution",
    "folder": "XIII. Follow Motion Device",
    "description": "Switch the Follow Target of the Follow Motion Device by GUID.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that a Follow Motion Device is attached to"
      },
      {
        "name": "Follow Target GUID",
        "type": "guid",
        "description": "Identifier for the Follow Target"
      },
      {
        "name": "Follow Target Attachment Point Name",
        "type": "string",
        "description": "Name of the Attachment Point to follow",
        "defaultVal": "",
        "placeholder": "Follow Target Attachment Point Name"
      },
      {
        "name": "Location Offset",
        "type": "vector3",
        "description": "Location Offset based on the Follow Coordinate System"
      },
      {
        "name": "Rotation Offset",
        "type": "vector3",
        "description": "Rotation Offset based on the Follow Coordinate System"
      },
      {
        "name": "Follow Coordinate System",
        "type": "enum",
        "description": "Options: Relative Coordinate System or World Coordinate System"
      },
      {
        "name": "Follow Type",
        "type": "enum",
        "description": "Options: Completely Follow, Follow Location, Follow Rotation"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_switch_follow_motion_device_target_by_entity",
    "name": "Switch Follow Motion Device Target by Entity",
    "category": "execution",
    "folder": "XIII. Follow Motion Device",
    "description": "Switch the Follow Target of the Follow Motion Device by Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that a Follow Motion Device is attached to"
      },
      {
        "name": "Follow Target Entity",
        "type": "entity",
        "description": "The Entity that follows the Target"
      },
      {
        "name": "Follow Target Attachment Point Name",
        "type": "string",
        "description": "Name of the Attachment Point to follow",
        "defaultVal": "",
        "placeholder": "Follow Target Attachment Point Name"
      },
      {
        "name": "Location Offset",
        "type": "vector3",
        "description": "Location Offset based on the Follow Coordinate System"
      },
      {
        "name": "Rotation Offset",
        "type": "vector3",
        "description": "Rotation Offset based on the Follow Coordinate System"
      },
      {
        "name": "Follow Coordinate System",
        "type": "enum",
        "description": "Options: Relative Coordinate System or World Coordinate System"
      },
      {
        "name": "Follow Type",
        "type": "enum",
        "description": "Options: Completely Follow, Follow Location, Follow Rotation"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_create_projectile",
    "name": "Create Projectile",
    "category": "execution",
    "folder": "XIV. Projectiles",
    "description": "Create a Projectile Entity using the Prefab ID. This function is similar to `Create Prefab`, but includes an additional `Track Target` parameter, which sets the tracking target for projectiles of the Tracking type in the Projectile Motion Device Component of the created Entity.",
    "inputs": [
      {
        "name": "Prefab ID",
        "type": "prefab_id",
        "description": "Identifier for this Projectile Prefab"
      },
      {
        "name": "Location",
        "type": "vector3",
        "description": "Absolute Location"
      },
      {
        "name": "Rotate",
        "type": "vector3",
        "description": "Absolute Rotation"
      },
      {
        "name": "Owner Entity",
        "type": "entity",
        "description": "Determines whether the created entity belongs to another entity"
      },
      {
        "name": "Track Target",
        "type": "entity",
        "description": "The Tracking Target set by the Tracking Projectile type in the Projectile Motion Device component"
      },
      {
        "name": "Overwrite Level",
        "type": "bool",
        "description": "When set to False, the `Level` parameter has no effect",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Level",
        "type": "int",
        "description": "Determines the Level when the entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Unit Tag Index List",
        "type": "int",
        "description": "Determines the Unit Tags carried when this entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Created Entity",
        "type": "entity",
        "description": "This Entity inherits the attributes of the Projectile Prefab"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_play_timed_effects",
    "name": "Play Timed Effects",
    "category": "execution",
    "folder": "XV. Special Effects",
    "description": "Play a Timed Effect relative to the Target Entity. A valid Target Entity and Attachment Point are required.",
    "inputs": [
      {
        "name": "Special Effects Asset",
        "type": "config_id",
        "description": "Identifier for this Effect"
      },
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "If the Entity does not exist, the Effect will not play"
      },
      {
        "name": "Attachment Point Name",
        "type": "string",
        "description": "If the Attachment Point Name does not exist, the Special Effect will not play",
        "defaultVal": "",
        "placeholder": "Attachment Point Name"
      },
      {
        "name": "Move With the Target",
        "type": "bool",
        "description": "If set to True, follows the Target Entity's Motion",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Rotate With the Target",
        "type": "bool",
        "description": "If set to True, follows the Target Entity's Rotation",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Location Offset",
        "type": "vector3",
        "description": "Location Offset relative to the Target Entity's specified Attachment Point"
      },
      {
        "name": "Rotation Offset",
        "type": "vector3",
        "description": "Rotation offset relative to the Target Entity's specified Attachment Point"
      },
      {
        "name": "Zoom Multiplier",
        "type": "float",
        "description": "The Zoom Multiplier of this Effect",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Play Built-In Sound Effect",
        "type": "bool",
        "description": "If set to True, plays the built-in Sound Effect as well",
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
    "id": "exec_clear_special_effects_based_on_special_effect_assets",
    "name": "Clear Special Effects Based on Special Effect Assets",
    "category": "execution",
    "folder": "XV. Special Effects",
    "description": "Clear all Effects on the specified Target Entity that use the given Effect Asset. Applies to Looping Effects only.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Special Effects Asset",
        "type": "config_id",
        "description": "Identifier for this Effect"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_mount_looping_special_effect",
    "name": "Mount Looping Special Effect",
    "category": "execution",
    "folder": "XV. Special Effects",
    "description": "Mount a Looping Effect relative to the Target Entity. A valid Target Entity and Attachment Point are required. This node returns an Effect Instance ID that can be stored. When using the `Clear Looping Effects` node later, use this Effect Instance ID to clear the specified Looping Effect.",
    "inputs": [
      {
        "name": "Special Effects Asset",
        "type": "config_id",
        "description": "Identifier for this Effect"
      },
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "If the Entity does not exist, the Effect will not play"
      },
      {
        "name": "Attachment Point Name",
        "type": "string",
        "description": "If the Attachment Point Name does not exist, the Special Effect will not play",
        "defaultVal": "",
        "placeholder": "Attachment Point Name"
      },
      {
        "name": "Move With the Target",
        "type": "bool",
        "description": "If set to True, follows the Target Entity's Motion",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Rotate With the Target",
        "type": "bool",
        "description": "If set to True, follows the Target Entity's Rotation",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Location Offset",
        "type": "vector3",
        "description": "Location Offset relative to the Target Entity's specified Attachment Point"
      },
      {
        "name": "Rotation Offset",
        "type": "vector3",
        "description": "Rotation offset relative to the Target Entity's specified Attachment Point"
      },
      {
        "name": "Zoom Multiplier",
        "type": "float",
        "description": "The Zoom Multiplier of this Effect",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Play Built-In Sound Effect",
        "type": "bool",
        "description": "Toggle to Yes to play built-in sound effects",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [
      {
        "name": "Special Effect Instance ID",
        "type": "int",
        "description": "The Instance ID automatically generated when mounting this Effect"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_clear_looping_special_effect",
    "name": "Clear Looping Special Effect",
    "category": "execution",
    "folder": "XV. Special Effects",
    "description": "Clear the specified Looping Effect on the Target Entity by Effect Instance ID. After a successful mount, the `Mount Looping Effect` node generates an Effect Instance ID.",
    "inputs": [
      {
        "name": "Special Effect Instance ID",
        "type": "int",
        "description": "Instance ID automatically generated by the Mount Looping Special Effect node",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_resume_timer",
    "name": "Resume Timer",
    "category": "execution",
    "folder": "XVI. Timer",
    "description": "Resume a paused Timer on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Timer Identifier",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_start_timer",
    "name": "Start Timer",
    "category": "execution",
    "folder": "XVI. Timer",
    "description": "Start a Timer on the Target Entity. The Timer is uniquely identified by its name. A Timer consists of a looping or non-looping Timer Sequence. The Timer Sequence is a set of time points in seconds arranged in ascending order; when the Timer reaches these points, it triggers the `On Timer Triggered` event. The maximum length of a Timer Sequence is 100. For example, if you input the Timer Sequence `[1, 3, 5, 7]`, the `On Timer Triggered` event fires at 1s, 3s, 5s, and 7s. When Loop is set to `Yes`, the Timer restarts from 0s after reaching the last time point. For `[1, 3, 5, 7]`, it restarts from 0s after reaching 7s.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Timer Identifier",
        "defaultVal": "",
        "placeholder": "Timer Name"
      },
      {
        "name": "Loop",
        "type": "bool",
        "description": "If set to True, the Timer Sequence executes in a loop",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Timer Sequence",
        "type": "float",
        "description": "Provide a list sorted in ascending order. If the list is invalid (not strictly ascending, contains negatives, etc.), the Timer will not run",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_pause_timer",
    "name": "Pause Timer",
    "category": "execution",
    "folder": "XVI. Timer",
    "description": "Pauses the specified Timer on the Target Entity. The `Resume Timer` node can then be used to resume its countdown.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Timer Identifier",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_stop_timer",
    "name": "Stop Timer",
    "category": "execution",
    "folder": "XVI. Timer",
    "description": "Completely terminate the specified Timer on the Target Entity; it cannot be resumed.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Timer Identifier",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_recover_global_timer",
    "name": "Recover Global Timer",
    "category": "execution",
    "folder": "XVII. Global Timer",
    "description": "Resume a paused Global Timer on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Identifier for the Timer. Only Timer Names configured in Timer Management can be referenced",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_start_global_timer",
    "name": "Start Global Timer",
    "category": "execution",
    "folder": "XVII. Global Timer",
    "description": "Start a Global Timer on the Target Entity. The Timer on the Target Entity is uniquely identified by its name. Based on Timer Management settings, Countdown and Stopwatch Timers are created accordingly.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Identifier for the Timer. Only Timer Names configured in Timer Management can be referenced",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_global_timer_value",
    "name": "Increase Global Timer Value",
    "category": "execution",
    "folder": "XVII. Global Timer",
    "description": "Adjust the time of a running Global Timer via the Node Graph. If the timer is paused first and then modified to reduce the time, the modified time will be at least 0 seconds. For countdown timers, pausing followed by modifying the time to 0s will trigger the `When the Global Timer Is Triggered` event upon resuming the timer. If the timer is paused first, then modified to 0s, followed by modifying the time to increase it, and finally resumed, the `When the Global Timer Is Triggered` event will not be triggered.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Identifier for the Timer. Only Timer Names configured in Timer Management can be referenced",
        "defaultVal": "",
        "placeholder": "Timer Name"
      },
      {
        "name": "Increase Value",
        "type": "float",
        "description": "For a Countdown Timer, a positive value increases the remaining time; a negative value decreases the remaining time. If the timer is set to Stopwatch, a positive value increases the accumulated time, while a negative value decreases it",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_pause_global_timer",
    "name": "Pause Global Timer",
    "category": "execution",
    "folder": "XVII. Global Timer",
    "description": "Pause a running Global Timer via the Node Graph. When paused, the UI controls linked to the timer will also pause their display.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Identifier for the Timer. Only Timer Names configured in Timer Management can be referenced",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_stop_global_timer",
    "name": "Stop Global Timer",
    "category": "execution",
    "folder": "XVII. Global Timer",
    "description": "Use the node graph to stop running a global timer early.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "description": "Identifier for the Timer. Only Timer Names configured in Timer Management can be referenced",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_switch_main_camera_template",
    "name": "Switch Main Camera Template",
    "category": "execution",
    "folder": "XVIII. Camera",
    "description": "Switch the Main Camera Template for the target Player List to the specified Template.",
    "inputs": [
      {
        "name": "Target Player List",
        "type": "entity",
        "description": "Active Player List"
      },
      {
        "name": "Camera Template Name",
        "type": "string",
        "description": "Camera Template Identifier",
        "defaultVal": "",
        "placeholder": "Camera Template Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_camera_to_follow_entity",
    "name": "Set Player Camera to Follow Entity",
    "category": "execution",
    "folder": "XVIII. Camera",
    "description": "Set the specified Player Entity's camera to follow the target entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Follow Entity",
        "type": "entity",
        "description": "Camera Target Entity"
      },
      {
        "name": "Camera Template Name",
        "type": "string",
        "description": "Camera Template Identifier",
        "defaultVal": "",
        "placeholder": "Camera Template Name"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_reset_player_camera_to_follow_entity",
    "name": "Reset Player Camera to Follow Entity",
    "category": "execution",
    "folder": "XVIII. Camera",
    "description": "Reset the player camera to follow the Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_character_disruptor_device",
    "name": "Set Character Disruptor Device",
    "category": "execution",
    "folder": "XIX. Character Disruptor Device",
    "description": "Edit the Character Disruptor Device active on the Target Entity by ID; if the ID does not exist, the Character Disruptor Device will no longer function after the modification.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Active Entity"
      },
      {
        "name": "Device ID",
        "type": "int",
        "description": "Identifier for the Character Disruptor Device",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_unit_status",
    "name": "Add Unit Status",
    "category": "execution",
    "folder": "XX. Unit Status",
    "description": "Add a specified Stack Count of Unit Status to the Target Entity.",
    "inputs": [
      {
        "name": "Applier Entity",
        "type": "entity",
        "description": "Determines the Applier Entity for this action. Defaults to the Entity associated with this Node Graph"
      },
      {
        "name": "Application Target Entity",
        "type": "entity",
        "description": "The Entity that actually receives this Unit Status"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id",
        "description": "Identifier for this Unit Status"
      },
      {
        "name": "Applied Stacks",
        "type": "int",
        "description": "The Stack Count for this Unit Status",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Unit Status Parameter Dictionary",
        "type": "dict",
        "description": "You can carry a set of parameters to override the configuration values in the unit's state"
      }
    ],
    "outputs": [
      {
        "name": "Application Result",
        "type": "enum",
        "description": "Failed, other exceptions. Failed: Yielded to another status. A yielding relationship exists between the Target's current Unit Status and the one being applied. Failed: Maximum coexistence limit reached. The specified Unit Status on the Target Entity has reached its Coexistence Limit. Failed: Unable to add additional stack. Stack addition failed. Success: New status applied. Successfully applied new Unit Status. Success: Slot stacking. Target already has this Unit Status, stacking applied"
      },
      {
        "name": "Slot ID",
        "type": "int",
        "description": "If application succeeds, returns the Unit Status Slot ID containing the instance"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_unit_status",
    "name": "Remove Unit Status",
    "category": "execution",
    "folder": "XX. Unit Status",
    "description": "Remove a specified Unit Status from the Target Entity. Either all stacks or a single stack can be removed.",
    "inputs": [
      {
        "name": "Remove Target Entity",
        "type": "entity",
        "description": "The Entity from which the Unit Status will be removed"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id",
        "description": "Identifier for this Unit Status"
      },
      {
        "name": "Removal Method",
        "type": "enum",
        "description": "All Coexisting Statuses with the Same Name: Removes all statuses applied with this Config ID that share the same name. Status With Fastest Stack Loss: Removes one stack from the status that loses stacks the fastest"
      },
      {
        "name": "Remover Entity",
        "type": "entity",
        "description": "Determines the Remover Entity for this action. Defaults to the Entity associated with this Node Graph"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  }
];
