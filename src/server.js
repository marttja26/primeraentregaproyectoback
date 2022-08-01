const express = require('express');
const { Router } = express;
const fs = require('fs');

const app = express();

// CONTAINER

class ContainerFs {
	constructor(ruta) {
		this.ruta = ruta;
	}

	async getAll() {
		try {
			const objetos = JSON.parse(
				await fs.promises.readFile(this.ruta, 'utf-8')
			);
			return objetos;
		} catch (error) {
			console.log(error);
			return [];
		}
	}

	async get(id) {
		const objetos = await this.getAll();
		const objeto = objetos.find((obj) => obj.id == id);
		if (objeto == undefined) {
			throw new Error(`Ocurrio un error, no se encontro el id ${id}`);
		} else {
			return objeto;
		}
	}

	async save(objeto) {
		const objetos = await this.getAll();
		const idList = objetos.map((a) => a.id);
		const largestId = idList.reduce((a, b) => {
			return Math.max(a, b);
		}, 0);
		const newId = largestId + 1;
		const timestamp = new Date().toLocaleString('es-AR');
		objetos.push({ ...objeto, timestamp, id: newId || 1 });
		try {
			await fs.promises.writeFile(this.ruta, JSON.stringify(objetos));
			return newId;
		} catch (error) {
			throw new Error(`Hubo un error al guardar el archivo ${error}`);
		}
	}

	async update(objeto, id) {
		const objetos = await this.getAll();
		const index = objetos.findIndex((obj) => obj.id == id);
		const hora = new Date().toLocaleString('es-AR');
		if (index == -1) {
			throw new Error(
				`Hubo un error al actualizar, no se encontro el id ${id}`
			);
		} else {
			objetos[index] = { ...objeto, id, hora };
		}
		try {
			await fs.promises.writeFile(this.ruta, JSON.stringify(objetos));
		} catch (error) {
			throw new Error(`Hubo un error al editar el archivo ${error}`);
		}
	}

	async delete(id) {
		const objetos = await this.getAll();
		const index = objetos.findIndex((obj) => obj.id == id);
		if (index == -1) {
			throw new Error(
				`Hubo un error al borrar el archivo, no se encontro el id ${id}`
			);
		} else {
			objetos.splice(index, 1);
		}
		try {
			await fs.promises.writeFile(this.ruta, JSON.stringify(objetos));
		} catch (error) {
			throw new Error(`Hubo un error al borrar el archivo ${error}`);
		}
	}

	async deleteAll() {
		try {
			await fs.promises.writeFile(this.ruta, JSON.stringify([]));
		} catch (error) {
			throw new Error(`Hubo un error al borrar todo el archivo ${error}`);
		}
	}
}

const carritosApi = new ContainerFs('./src/cart.json');
const productosApi = new ContainerFs('./src/products.json');


// HANDLER

const urlCheck = (req, res, next) => {
	if (req.url.includes('/api/carrito') || req.url.includes('/api/productos'))
		next()
	else
		res.json({
			error: -2,
			description: `ruta ${req.originalUrl} metodo ${req.method} no implementada`,
		});
};


// ADMIN

const Admin = true;

const noEsAdmin = (ruta, metodo) => {
	const error = {
		error: -1,
	};

	if (ruta && metodo) {
		error.description = `ruta '${ruta}' metodo '${metodo}' no autorizado`;
	} else {
		error.description = 'no autorizado';
	}
	return error;
};

const onlyAdm = (req, res, next) => {
	if (!Admin) {
		res.json(noEsAdmin(req.baseUrl, req.method));
	} else {
		next();
	}
};

// Router de Productos

const productosRouter = new Router();

productosRouter.get('/', async (req, res) => {
	res.json(await productosApi.getAll());
});

productosRouter.get('/:id', async (req, res) => {
	res.json(await productosApi.get(parseInt(req.params.id)));
});

productosRouter.post('/', onlyAdm, async (req, res) => {
	res.json(await productosApi.save(req.body));
});

productosRouter.put('/:id', onlyAdm, async (req, res) => {
	res.json(await productosApi.update(req.body, parseInt(req.params.id)));
});

productosRouter.delete('/:id', onlyAdm, async (req, res) => {
	res.json(await productosApi.delete(parseInt(req.params.id)));
});

// Router de Carrito

const carritoRouter = new Router();

carritoRouter.get('/', async (req, res) => {
	res.json((await carritosApi.getAll()).map((carrito) => carrito.id));
});

carritoRouter.post('/', async (req, res) => {
	res.json({ id: await carritosApi.save({ productos: [] }) });
});

carritoRouter.delete('/:id', async (req, res) => {
	res.json(await carritosApi.delete(parseInt(req.params.id)));
});

carritoRouter.get('/:id/productos', async (req, res) => {
	const carrito = await carritosApi.get(parseInt(req.params.id));
	res.json(carrito.productos);
});

carritoRouter.post('/:id/:productos', async (req, res) => {
	const carrito = await carritosApi.get(parseInt(req.params.id));
	const producto = await productosApi.get(parseInt(req.params.productos));
	carrito.productos.push(producto);
	await carritosApi.update(carrito, parseInt(req.params.id));
	res.end();
});

carritoRouter.delete('/:id/productos/:id_prod', async (req, res) => {
	const carrito = await carritosApi.get(parseInt(req.params.id));
	const index = carrito.productos.findIndex(
		(producto) => producto.id == parseInt(req.params.id_prod)
	);
	if (index != -1) {
		carrito.productos.splice(index, 1);
		await carritosApi.update(carrito, parseInt(req.params.id));
	}
	res.end();
});


// Server

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(urlCheck)

app.use('/api/productos', productosRouter);
app.use('/api/carrito', carritoRouter);

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
	console.log(`Servidor Http escuchando en el puerto ${server.address().port}`);
});
server.on('error', (error) => console.log(`Error en servidor ${error}`));
