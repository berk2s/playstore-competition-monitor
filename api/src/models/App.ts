import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const appSchema = new Schema(
  {
    packageName: { type: String, required: true, unique: true, index: true },
    playUrl: { type: String, required: true },
    title: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    lastCapturedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type AppDoc = HydratedDocument<InferSchemaType<typeof appSchema>>;
export const AppModel = model('App', appSchema);
