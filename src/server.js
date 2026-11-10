

const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auth = require('../middlewares/auth');

router.use(auth);

// LISTAR CHAMADOS
router.get('/', async (req, res) => {
    try {
        const chamados = await prisma.ticket.findMany({
            where: req.user.role === 'SOLICITANTE'
                ? { solicitanteId: req.user.id }
                : {},
            include: {
                solicitante: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                tecnico: {
                    select: {
                        id: true,
                        nome: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(chamados);

    } catch (error) {
        res.status(500).json({ erro: 'Erro ao listar chamados' });
    }
});


// CRIAR CHAMADO
router.post('/', async (req, res) => {
    try {
        const { titulo, descricao, prioridade, prazoSLA } = req.body;

        if (!titulo || !descricao) {
            return res.status(400).json({
                erro: 'Título e descrição são obrigatórios'
            });
        }

        const chamado = await prisma.ticket.create({
            data: {
                titulo,
                descricao,
                prioridade: prioridade || 'MEDIA',
                prazoSLA: prazoSLA ? new Date(prazoSLA) : null,
                solicitanteId: req.user.id,

                historicos: {
                    create: {
                        acao: 'CHAMADO CRIADO',
                        detalhes: 'Abertura de novo chamado',
                        usuarioId: req.user.id
                    }
                }
            }
        });

        res.status(201).json(chamado);

    } catch (error) {
        res.status(500).json({ erro: 'Erro ao criar chamado' });
    }
});


// BUSCAR CHAMADO POR ID
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        const chamado = await prisma.ticket.findUnique({
            where: { id },
            include: {
                solicitante: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                tecnico: {
                    select: {
                        id: true,
                        nome: true
                    }
                },
                historicos: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    include: {
                        usuario: {
                            select: {
                                nome: true
                            }
                        }
                    }
                }
            }
        });

        if (!chamado) {
            return res.status(404).json({
                erro: 'Chamado não encontrado'
            });
        }

        if (
            req.user.role === 'SOLICITANTE' &&
            chamado.solicitanteId !== req.user.id
        ) {
            return res.status(403).json({
                erro: 'Acesso não autorizado'
            });
        }

        res.json(chamado);

    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar chamado' });
    }
});


// ATUALIZAR CHAMADO
router.patch('/:id', async (req, res) => {
    try {
        if (!['ADMIN', 'TECNICO'].includes(req.user.role)) {
            return res.status(403).json({
                erro: 'Sem permissão para atualizar chamados'
            });
        }

        const id = Number(req.params.id);

        const chamado = await prisma.ticket.findUnique({
            where: { id }
        });

        if (!chamado) {
            return res.status(404).json({
                erro: 'Chamado não encontrado'
            });
        }

        const { titulo, descricao, status, prioridade, tecnicoId } = req.body;

        const dados = {};

        if (titulo !== undefined) dados.titulo = titulo;
        if (descricao !== undefined) dados.descricao = descricao;
        if (status !== undefined) dados.status = status;
        if (prioridade !== undefined) dados.prioridade = prioridade;
        if (tecnicoId !== undefined) dados.tecnicoId = tecnicoId;

        if (status === 'CONCLUIDO') {
            dados.concluidoAt = new Date();
        }

        const atualizado = await prisma.$transaction(async (tx) => {

            const resultado = await tx.ticket.update({
                where: { id },
                data: dados
            });

            await tx.historico.create({
                data: {
                    acao: 'CHAMADO ATUALIZADO',
                    detalhes: JSON.stringify(dados),
                    ticketId: id,
                    usuarioId: req.user.id
                }
            });

            return resultado;
        });

        res.json(atualizado);

    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar chamado' });
    }
});


// HISTÓRICO DO CHAMADO
router.get('/:id/historico', async (req, res) => {
    try {
        const id = Number(req.params.id);

        const chamado = await prisma.ticket.findUnique({
            where: { id }
        });

        if (!chamado) {
            return res.status(404).json({
                erro: 'Chamado não encontrado'
            });
        }

        if (
            req.user.role === 'SOLICITANTE' &&
            chamado.solicitanteId !== req.user.id
        ) {
            return res.status(403).json({
                erro: 'Acesso não autorizado'
            });
        }

        const historico = await prisma.historico.findMany({
            where: { ticketId: id },
            include: {
                usuario: {
                    select: {
                        nome: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(historico);

    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar histórico' });
    }
});

module.exports = router;



const express = require('express');
const app = express();

app.use(express.json());

const chamadosRoutes = require('./routes/chamados');

app.use('/api/chamados', chamadosRoutes);

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

