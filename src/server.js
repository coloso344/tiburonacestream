import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
app.use(cors());

// 1. Definimos el proxy
const streamProxy = createProxyMiddleware({
    target: 'http://skybeyondplus.mine.nu:25461',
    changeOrigin: true,
    pathRewrite: {
        '^/stream': '',
    },
    onProxyReq: function (proxyReq, req, res) {
        proxyReq.setHeader('User-Agent', 'IPTVSmarters');
        proxyReq.setHeader('Host', 'tiburonacestream.onrender.com');
    },
    onProxyRes: function (proxyRes, req, res) {
        // Headers CORS
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Headers'] = '*';

        // 2. INTERCEPTAMOS EL ARCHIVO .m3u8 PARA EDITARLO
        if (req.url.includes('.m3u8')) {
            let body = '';
            proxyRes.on('data', (chunk) => { body += chunk; });
            proxyRes.on('end', () => {
                // LOG para verificar en Render que entramos aquí
                console.log(">> Interceptando playlist m3u8. Longitud:", body.length);

                // REEMPLAZO TOTAL:
                // Cambiamos "http://206.221.176.51:25461" por "https://tiburonacestream.onrender.com/stream"
                // Esto arregla: IP, Puerto y Protocolo (HTTPS)
                let newBody = body.replace(/http:\/\/206\.221\.176\.51:25461/g, 'https://tiburonacestream.onrender.com/stream');

                // Si por alguna razón la IP está sola sin protocolo, la cambiamos también
                newBody = newBody.replace(/206\.221\.176\.51/g, 'tiburonacestream.onrender.com');
                
                // Enviamos el archivo editado
                res.status(proxyRes.statusCode).send(newBody);
            });
            return; // IMPORTANTE: Detenemos el flujo para enviar nuestro archivo editado
        }

        // Para videos (.ts) u otros, dejamos pasar normal
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    }
});

app.use('/stream', streamProxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Tiburón en puerto ${PORT}`));