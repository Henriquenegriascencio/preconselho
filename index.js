const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());

// Configuração do Banco de Dados
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Insira a sua senha do MySQL aqui
    database: 'pre_conselho_db'
});

// 1. Rota Principal: Redireciona para o login por padrão
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

// 2. Servir Ficheiros Estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth/cadastro', async (req, res) => {
    const { nome, email, senha, tipo } = req.body;
    try {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
            [nome, email, senha, tipo]
        );
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro no cadastro:', err);
        res.status(500).json({ error: 'Erro ao cadastrar. O e-mail pode já estar em uso.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [usuarios] = await db.query(
            'SELECT id, nome, email, tipo FROM usuarios WHERE email = ? AND senha = ?',
            [email, senha]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        res.json({ usuario: usuarios[0] });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// --- ROTAS DO ADMINISTRADOR ---

app.post('/api/admin/fichas', async (req, res) => {
    const { titulo, turma_id, materia_id, data_limite, perguntas } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO fichas_avaliacao (titulo, turma_id, materia_id, data_limite) VALUES (?, ?, ?, ?)',
            [titulo, turma_id, materia_id, data_limite]
        );
        
        const fichaId = result.insertId;

        if (perguntas && perguntas.length > 0) {
            for (let p of perguntas) {
                await db.query(
                    'INSERT INTO perguntas (ficha_id, texto_pergunta, categoria) VALUES (?, ?, ?)',
                    [fichaId, p.texto_pergunta, p.categoria || 'Geral']
                );
            }
        }

        res.status(201).json({ message: 'Ficha criada com sucesso!', fichaId });
    } catch (err) {
        console.error('Erro ao criar ficha no MySQL:', err);
        res.status(500).json({ error: err.message });
    }
});

// Buscar respostas agrupadas com informações da turma e professor
app.get('/api/admin/fichas/:id/respostas', async (req, res) => {
    try {
        const [respostas] = await db.query(
            `SELECT 
                r.id,
                p.texto_pergunta,
                p.categoria,
                u.nome AS professor_nome,
                f.turma_id,
                r.resposta,
                r.anotacoes
            FROM respostas_pre_conselho r
            JOIN perguntas p ON r.pergunta_id = p.id
            JOIN usuarios u ON r.professor_id = u.id
            JOIN fichas_avaliacao f ON r.ficha_id = f.id
            WHERE r.ficha_id = ?
            ORDER BY u.nome, p.id`,
            [req.params.id]
        );
        res.json(respostas);
    } catch (err) {
        console.error('Erro ao buscar respostas:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ROTAS DO PROFESSOR (CONSULTA E RESPOSTAS) ---

app.get('/api/professor/fichas', async (req, res) => {
    try {
        const [fichas] = await db.query('SELECT * FROM fichas_avaliacao ORDER BY id DESC');
        res.json(fichas);
    } catch (err) {
        console.error('Erro ao buscar fichas:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/fichas/:id/perguntas', async (req, res) => {
    try {
        const [perguntas] = await db.query(
            'SELECT * FROM perguntas WHERE ficha_id = ?',
            [req.params.id]
        );
        res.json(perguntas);
    } catch (err) {
        console.error('Erro ao buscar perguntas:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/professor/respostas', async (req, res) => {
    const { ficha_id, professor_id, respostas } = req.body;
    try {
        for (let r of respostas) {
            await db.query(
                'INSERT INTO respostas_pre_conselho (ficha_id, pergunta_id, professor_id, resposta, anotacoes) VALUES (?, ?, ?, ?, ?)',
                [ficha_id, r.pergunta_id, professor_id, r.resposta, r.anotacoes || '']
            );
        }
        res.status(201).json({ message: 'Respostas enviadas com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar respostas:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});