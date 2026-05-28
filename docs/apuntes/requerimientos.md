## Lo que sabemos
La CIE o Clasificacion Internacional de Enfermedades, de la OMS cuenta con una API REST, que permite consultar sobre las enfermedades 
listadas en la clasificacion.
Esta API es gratuita y no requiere de una clave de acceso.
Puede ser instalada localmente, como un servicio web, e incluso ofrece una imagen oficial para contenedores docker.

### El personal
    * Su sistema se organiza en 9 estaciones.
    * Por cada estacion se tiene a 4 estudiantes y un docente encargados de manejar la estacion.
    * Hay un docente investigador que se denomina Jefe del viaje y 2 docentes de tiempo completo considerados organizadores.

### Los pacientes
Un paciente idealmente deberia pasar por todas las estaciones, pero puede ser que sea enviado desde una estacion 
hasta otra especifica.

### Las estaciones

<!-- NOTE: Campos cerrados, para poder determinar el sintoma, segun ALICIA (VER APUNTES) -->
<!-- Para tratar de estandarizar la forma de anotar los mismos -->
    - Anamnesis (Entrevista con el paciente para obtener un historial familiar, datos previos, etc)

    - Examen fisico general (Signos vitales)

<!-- NOTE: Ver por que es tan tardado -->
    - Examen fisico segmentario (Examen de cada parte del cuerpo)


<!-- NOTE: Revisar las fotos que me envie -->
<!-- Automatizar formulas y pensar en procedimientos -->
    - Scrining (Glicemia capilar, grupo sanguineo, EGO) (Examenes de laboratorio)

<!-- NOTE: Aclaraciones sobre los sintomas, son derivados desde aqui -->
<!-- Criterios para la derivacion: Patologias previas -->
    - Diagnostico Clinico / Farmacia

<!-- NOTE: Se imprimen los datos y se pegan en la historia -->
    - Electrocardiograma
    - Espirometria
    - Ecografia

    - Recoleccion de datos (realizada por los guias)

### Los medicamentos
Se tiene que mantener un control de stock, tanto de medicamentos como de otros insumos, con el objetivo de que se tenga un reporte
en el que se detalle cuales son insumos usados y que implican un costo importante, para realizar reportes para las autoridades de la comunidad.

### Sobre la historia medica
Los datos relevantes se tienen listados en el ejemplo de historia medica proporcionado por el product owner.
Gran mayoria de estos datos se encuentran mencionados anteriormente, ya que una historia medica conforma
una serie de datos que se obtienen en las estaciones.
De igual manera, una historia forma parte de un historial, o expediente, que es un conjunto de historias medicas.

## Mapa Parlante
<!-- NOTE: Revisitar la idea de maps para automatizar esta cosa -->
Informacion para determinar, en funcion de la distribucion geografica de los edificios cercanos a el centro medico
o incluso de donde vive el paciente, datos relevantes que puedan estar relacionados con el origen de las patologias.




