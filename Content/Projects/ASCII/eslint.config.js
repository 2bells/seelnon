export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                setTimeout: "readonly",
                fetch: "readonly",
                Math: "readonly",
                Array: "readonly",
                parseFloat: "readonly",
                parseInt: "readonly",
                requestAnimationFrame: "readonly",
                AudioContext: "readonly",
                webkitAudioContext: "readonly",
                Audio: "readonly",
                require: "readonly",
                __dirname: "readonly",
                module: "readonly",
                process: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error"
        }
    }
];
