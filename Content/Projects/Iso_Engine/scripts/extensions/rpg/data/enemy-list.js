export const enemy_types = {
    'slime': {
        name: 'Green Slime',
        assetName: 'enemy_slime',
        visualWidth: 32,
        visualHeight: 32,
        anchorOffsetX: 16,
        anchorOffsetY: 32,
        stats: {
            hp: 30,
            maxHp: 30,
            atk: 5,
            def: 2,
            speed: 80, // pixels per second
            aggroRange: 200, // pixels
            attackRange: 40, // pixels
            attackCooldown: 2, // seconds
        },
        collidable: true,
        collisionShape: {
            type: 'rectangle', // Simple collision for now
            width: 24,
            height: 12
            // xOffset and yOffset will be auto-calculated in GameObject constructor
        }
    }
};