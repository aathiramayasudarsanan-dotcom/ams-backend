import mongoose from "mongoose";

const { Schema, model } = mongoose;

const configSchema = new Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        value: {
            type: Schema.Types.Mixed,
            required: true,
        },
        description: {
            type: String,
            default: "",
        },
    },
    {
        collection: "config",
        timestamps: true,
    }
);

const Config = model("Config", configSchema);

export { Config };
