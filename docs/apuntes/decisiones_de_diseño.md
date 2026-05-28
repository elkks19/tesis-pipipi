<!-- WARN: OPCION ANTIGUA -->
<!-- Se usara la libreria [bob](https://bob.stephenafamo.com/docs/) para la creacion de queries, -->
<!-- mientras que las migraciones seran escritas en SQL puro, para que puedan ser ligeramente cambiadas e  -->
<!-- implementadas en algun otro motor de base de datos, en caso de que sea necesario. -->
<!-- Para desacoplar la base de datos de la aplicacion, se realizaran repositorios para cada tabla. -->

# Respecto a la base de datos
Se usara la libreria [gorm](https://gorm.io/) como orm y para el manejo de transacciones con la base de datos, mientras que las migraciones seran 
escritas en SQL puro, para que puedan ser ligeramente cambiadas e implementadas en algun otro motor de base de datos, en caso de que sea necesario, 
haciendo uso a la vez de la librería [go-migrate](https://github.com/golang-migrate/migrate) para la gestion de las mismas.

## Notas y posibles features
- Debido al dificil acceso a internet, se debe tener una base de datos local, que incluya el esquema, ademas 
de datos cruciales, para una posterior sincronizacion con la base de datos en la nube.
- Se contempla la idea de realizar una especie de servidor local y sin conexion entre los dispositivos del personal presente en 
el viaje, para que puedan trabajar en conjunto, compartir datos, y luego sincronizar los mismos con la base de datos en la nube.

# Respecto a la api
Se tendra un controlador que se encargara de manejar las peticiones de la aplicacion, y hara uso del respectivo
repositorio para gestionar los datos de la base de datos.
Sin embargo, este controlador retornara slices, que seran usadas en dos tipos de endpoint, uno que retornara dichos 
datos como hipertexto, para que pueda ser usado por el cliente web, por medio de htmx, y otro que formateara los datos
en JSON para que puedan ser usados por tanto el cliente movil, como la aplicacion de escritorio.

# Respecto a los clientes
Los clientes seran:
    - Un cliente web.
    - Un cliente movil.
    - Una aplicacion de escritorio.

## Cliente web
Sera escrito como parte del programa, haciendo uso de templ, tailwind y htmx para tener errores de las paginas en  html en el tiempo de 
compilacion y acelerar el proceso de desarrollo, incluyendose en el compilado y siendo servido por el mismo servidor del backend, lo 
que nos da la ventaja de renderizado en el servidor.

## Cliente movil
Sera hecho usando flutterflow, debido a la facilidad de diseño que se me da, y se conectara con la api por medio de los endpoints que 
retornan JSON

## Aplicacion de escritorio
<!-- TODO: Determinar la naturaleza de esta app-->
Se debe escoger las tecnologias con las que se implementara dicha aplicacion
Las actuales opciones incluyen:
    - https://gioui.org/
    - https://github.com/rajveermalviya/gamen
    - https://fyne.io/
    - https://wails.io/docs/howdoesitwork


## Para el registro de campos
Tabla en la que se registran los campos necesarios para x o y cosa
Tabla pivote entre el paciente y esta otra tabla en la que se registran las respuestas
