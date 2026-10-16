// Exemplo de plugin Lume API v1. Importe este arquivo pelo painel Plugins.
export default {
  id: 'example.grid', apiVersion: 1, name: 'Grade criativa', category: 'Composição', icon: '▦',
  description: 'Plugin de exemplo com composição em terços.',
  parameters: [{ key: 'opacity', label: 'Opacidade', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 }],
  render(ctx, frame, params) {
    ctx.strokeStyle = `rgba(255,255,255,${params.opacity})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
      ctx.moveTo(frame.width * i / 3, 0); ctx.lineTo(frame.width * i / 3, frame.height);
      ctx.moveTo(0, frame.height * i / 3); ctx.lineTo(frame.width, frame.height * i / 3);
    }
    ctx.stroke();
  }
};
