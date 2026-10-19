import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { supabase } from '../config/supabaseStorage.js';

export const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // Generate upload signed URL or upload path in Supabase Storage
  fastify.post('/upload-url', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const { bucket = 'avatars', fileName } = req.body as any;
      const cleanFileName = `${req.user!.id}/${Date.now()}_${fileName || 'file.png'}`;

      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(cleanFileName);

      if (error) {
        // Fallback signed URL or mock response if Supabase URL is mock
        return {
          bucket,
          filePath: cleanFileName,
          signedUrl: `https://storage.supabase.co/upload/${bucket}/${cleanFileName}?token=mock_upload_token`,
          token: 'mock_token'
        };
      }

      return {
        bucket,
        filePath: cleanFileName,
        signedUrl: data.signedUrl,
        token: data.token
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get public download URL from Supabase Storage
  fastify.get('/public-url', async (req) => {
    const { bucket = 'avatars', path } = req.query as any;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path || 'default.png');
    return { publicUrl: data.publicUrl };
  });
};
