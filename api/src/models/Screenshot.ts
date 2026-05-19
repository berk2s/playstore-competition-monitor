import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

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

export type ScreenshotDoc = HydratedDocument<InferSchemaType<typeof screenshotSchema>>;
export const ScreenshotModel = model('Screenshot', screenshotSchema);
export { Types as MongoTypes };
