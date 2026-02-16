import '../../lib/routes';
import { router } from '../../lib/router';

export const GET = router.openapi({
  title: 'Fortune API',
  version: '1.0.0',
  description: 'Pay-per-fortune cookie API',
});
