const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // necesario para rutas absolutas

const app = express();
const port = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configurar EJS para otras vistas
app.set("view engine", "ejs");

// Conexión PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'cita_medica',
  password: 'qwerty.123456',
  port: 5432,
});

// Registrar paciente
app.post('/pacientes', async (req, res) => {
  const { nro_documento, nombre, apellido, fecha_nacimiento, sexo, telefono, email, direccion } = req.body;
  try {
    const query = `
      INSERT INTO pacientes 
      (nro_documento, nombre, apellido, fecha_nacimiento, sexo, telefono, email, direccion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(query, [nro_documento, nombre, apellido, fecha_nacimiento, sexo, telefono, email, direccion]);
    res.status(201).send('Paciente registrado correctamente');
  } catch (err) {
    console.error(err);
    if (err.code === '23505') res.status(400).send('El número de documento ya existe');
    else res.status(500).send('Error al registrar paciente');
  }
});

//  Listar pacientes
app.get('/pacientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pacientes ORDER BY paciente_id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener pacientes');
  }
});

//  Mostrar formulario de nueva cita con EJS
app.get("/cita/nueva", async (req, res) => {
  try {
    const pacientesResult = await pool.query(
      "SELECT paciente_id, nombre, apellido, nro_documento FROM pacientes ORDER BY nombre"
    );
    const medicosResult = await pool.query(
      "SELECT medico_id, nombre, apellido, especialidad FROM medicos WHERE activo = true ORDER BY nombre"
    );

    res.render("nueva_cita", {
      pacientes: pacientesResult.rows,
      medicos: medicosResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar datos de pacientes y médicos");
  }
});

//  Guardar nueva cita
app.post('/cita/nueva', async (req, res) => {
  const { paciente_id, medico_id, fecha, hora, motivo } = req.body;
  try {
    const query = `
      INSERT INTO citas (paciente_id, medico_id, fecha, hora, motivo)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [paciente_id, medico_id, fecha, hora, motivo]);
    res.send("Cita registrada correctamente ");
  } catch (err) {
    console.error(err);
    if (err.code === '23505') res.status(400).send("El médico ya tiene una cita en esa fecha y hora.");
    else res.status(500).send("Error al registrar la cita.");
  }
});
//nuevo
// Mostrar formulario de actualización de cita
app.get('/cita/actualizar/:cita_id', async (req, res) => {
  const { cita_id } = req.params;

  try {
    // Obtener cita
    const citaRes = await pool.query(
      `SELECT c.cita_id, c.fecha, c.hora, c.medico_id, m.nombre, m.apellido
       FROM citas c
       JOIN medicos m ON c.medico_id = m.medico_id
       WHERE c.cita_id = $1`,
      [cita_id]
    );

    if (citaRes.rows.length === 0) {
      return res.status(404).send("Cita no encontrada");
    }

    const cita = citaRes.rows[0];

    // Obtener médicos activos
    const medicosRes = await pool.query(
      "SELECT medico_id, nombre, apellido, especialidad FROM medicos WHERE activo = true ORDER BY nombre"
    );

    res.render('actualizar_cita', {
      cita,
      medicos: medicosRes.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar la cita");
  }
});

// Guardar actualización de cita
app.post('/cita/actualizar', async (req, res) => {
  const { cita_id, medico_id, hora } = req.body;

  try {
    // Obtener fecha de la cita original
    const citaRes = await pool.query(
      'SELECT fecha FROM citas WHERE cita_id = $1',
      [cita_id]
    );
    if (citaRes.rows.length === 0) return res.status(404).send('Cita no encontrada');

    const fecha = citaRes.rows[0].fecha;

    // Actualizar cita
    await pool.query(
      `UPDATE citas
       SET medico_id = $1, hora = $2, updated_at = now()
       WHERE cita_id = $3`,
      [medico_id, hora, cita_id]
    );

    res.send('Cita actualizada correctamente ');
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(400).send('El médico ya tiene otra cita en esa fecha y hora.');
    } else {
      res.status(500).send('Error al actualizar la cita');
    }
  }
});
//
// Listar todas las citas
app.get('/citas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.cita_id, c.fecha, c.hora, c.motivo,
             p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
             m.nombre AS medico_nombre, m.apellido AS medico_apellido, m.especialidad
      FROM citas c
      JOIN pacientes p ON c.paciente_id = p.paciente_id
      JOIN medicos m ON c.medico_id = m.medico_id
      ORDER BY c.fecha DESC, c.hora DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener citas');
  }
});



//  Iniciar servidor
app.listen(port, () => {
  console.log(` Servidor corriendo en http://localhost:${port}`);
});
