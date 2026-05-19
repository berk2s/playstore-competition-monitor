import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  appSchema,
  screenshotSchema,
  createAppInputSchema,
  updateAppInputSchema,
  errorResponseSchema,
} from '../schemas.ts';
import { parsePlayUrl } from '../play-url.ts';
import { AppModel } from '../models/App.ts';
import { ScreenshotModel } from '../models/Screenshot.ts';
import { serializeApp, serializeScreenshot } from '../serializers.ts';
import { enqueueCapture } from '../queue.ts';

const idParamSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id') });

const errResponses = {
  400: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

export async function appsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/apps',
    {
      schema: {
        response: { 200: z.object({ apps: z.array(appSchema) }) },
      },
    },
    async () => {
      const apps = await AppModel.find().sort({ createdAt: -1 });
      return { apps: apps.map(serializeApp) };
    },
  );

  r.get(
    '/apps/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 200: appSchema, ...errResponses },
      },
    },
    async (req, reply) => {
      const doc = await AppModel.findById(req.params.id);
      if (!doc) return reply.code(404).send({ error: 'not_found', message: 'App not found' });
      return serializeApp(doc);
    },
  );

  r.post(
    '/apps',
    {
      schema: {
        body: createAppInputSchema,
        response: { 201: appSchema, ...errResponses },
      },
    },
    async (req, reply) => {
      const parsed = parsePlayUrl(req.body.playUrl);
      if (!parsed) {
        return reply
          .code(400)
          .send({ error: 'invalid_play_url', message: 'Could not parse Play Store URL' });
      }
      const existing = await AppModel.findOne({ packageName: parsed.packageName });
      if (existing) {
        return reply
          .code(409)
          .send({ error: 'already_exists', message: 'This app is already being tracked' });
      }
      const doc = await AppModel.create({
        packageName: parsed.packageName,
        playUrl: parsed.canonicalUrl,
        title: req.body.title ?? null,
        active: true,
      });
      await enqueueCapture({
        appId: doc._id.toString(),
        packageName: doc.packageName,
        reason: 'manual',
      });
      return reply.code(201).send(serializeApp(doc));
    },
  );

  r.patch(
    '/apps/:id',
    {
      schema: {
        params: idParamSchema,
        body: updateAppInputSchema,
        response: { 200: appSchema, ...errResponses },
      },
    },
    async (req, reply) => {
      const doc = await AppModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!doc) return reply.code(404).send({ error: 'not_found', message: 'App not found' });
      return serializeApp(doc);
    },
  );

  r.delete(
    '/apps/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 204: z.null(), ...errResponses },
      },
    },
    async (req, reply) => {
      const doc = await AppModel.findByIdAndDelete(req.params.id);
      if (!doc) return reply.code(404).send({ error: 'not_found', message: 'App not found' });
      await ScreenshotModel.deleteMany({ appId: doc._id });
      return reply.code(204).send(null);
    },
  );

  r.get(
    '/apps/:id/screenshots',
    {
      schema: {
        params: idParamSchema,
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          status: z.enum(['success', 'failed']).optional(),
        }),
        response: {
          200: z.object({ screenshots: z.array(screenshotSchema) }),
          ...errResponses,
        },
      },
    },
    async (req, reply) => {
      const appDoc = await AppModel.findById(req.params.id);
      if (!appDoc) return reply.code(404).send({ error: 'not_found', message: 'App not found' });
      const filter: Record<string, unknown> = { appId: appDoc._id };
      if (req.query.status) filter.status = req.query.status;
      const docs = await ScreenshotModel.find(filter)
        .sort({ capturedAt: -1 })
        .limit(req.query.limit);
      return { screenshots: docs.map(serializeScreenshot) };
    },
  );

  r.post(
    '/apps/:id/capture',
    {
      schema: {
        params: idParamSchema,
        response: {
          202: z.object({ enqueued: z.boolean(), jobId: z.string() }),
          ...errResponses,
        },
      },
    },
    async (req, reply) => {
      const doc = await AppModel.findById(req.params.id);
      if (!doc) return reply.code(404).send({ error: 'not_found', message: 'App not found' });
      const job = await enqueueCapture({
        appId: doc._id.toString(),
        packageName: doc.packageName,
        reason: 'manual',
      });
      return reply.code(202).send({ enqueued: true, jobId: job.id ?? '' });
    },
  );
}
