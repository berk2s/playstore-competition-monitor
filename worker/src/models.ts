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

const screenshotSchema = new Schema(
  {
    appId: { type: Schema.Types.ObjectId, ref: 'App', required: true, index: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    imageKey: { type: String, default: null },
    imageUrl: { type: String, default: null },
    capturedAt: { type: Date, required: true, index: true },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);
screenshotSchema.index({ appId: 1, capturedAt: -1 });

export type AppDoc = HydratedDocument<InferSchemaType<typeof appSchema>>;
export type ScreenshotDoc = HydratedDocument<InferSchemaType<typeof screenshotSchema>>;

export const AppModel = model('App', appSchema);
export const ScreenshotModel = model('Screenshot', screenshotSchema);
