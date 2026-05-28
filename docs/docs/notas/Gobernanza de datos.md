Extraido esde [sci-bot](https://sci-bot.ru)

links:
https://sci-net.xyz/10.1007/978-3-031-40942-4_12

1. Definición del concepto: ¿Qué es gobernanza de datos?

La gobernanza de datos se define como "el ejercicio de autoridad y control sobre la gestión de los datos" (DAMA International, citado por Abraham et al., 2019). Su propósito es "aumentar el valor de los datos y minimizar los costos y riesgos relacionados con los datos" [1]. Zhang et al. (2022) la conciben como "la gestión disciplinada y legítima de los datos como un activo estratégico para la empresa, con la intervención de ciertos procedimientos, reglas e incluso valores" [2].

Desde el punto de vista de la medición, Abraham et al. (2019) proponen descomponer la gobernanza de datos en seis dimensiones: (1) antecedentes organizacionales, (2) parámetros de alcance, (3) mecanismos de gobierno (decisión, estructura, proceso, comunicación, formalización, y métricas/monitoreo), y (4) resultados esperados [1].

Para poder de alguna forma "medir" el estado en el que se encuentra la gobernanza de datos en una organizacion se usan los [[Modelos de madurez]]


2. Principales enfoques para medir la mejora
2.1 Modelos de Madurez (Maturity Models)

Los modelos de madurez son la herramienta más utilizada en la literatura para evaluar y medir la mejora en gobernanza de datos. Estos modelos establecen niveles progresivos que describen el estado de la gobernanza, desde estados iniciales (ad hoc) hasta estados optimizados.

El Modelo MAMD (Alarcos' Model for Data Maturity), desarrollado por Caballero et al. (2023), es un marco basado en ISO/IEC 33000 que integra gobernanza de datos, gestión de datos y gestión de calidad de datos. Incluye un Modelo de Referencia de Procesos (PRM) y un Modelo de Evaluación de Procesos (PAM) con niveles específicos de madurez [3].

El Stanford Maturity Model ha sido aplicado exitosamente en múltiples estudios de caso. Kurniawan et al. (2019) lo utilizaron para evaluar la madurez de la gobernanza de datos en una oficina gubernamental de auditoría, encontrando un nivel de madurez promedio de 2.63 (en una escala típica de 1 a 5), indicando que la institución ya tenía metapolíticas de alto nivel pero requería mejoras en administración de datos (stewardship) y metadatos [4].

Suroso y Permana (2018) aplicaron este mismo modelo combinado con DAMA DMBOK (Data Management Body of Knowledge) como referencia de mejores prácticas para identificar brechas entre el nivel actual y el nivel deseado de madurez [5].

El modelo DMM (Data Management Maturity) y su variante DMM Index (DMMI) fue aplicado por Thomas et al. (2019) en un estudio empírico a gran escala en 15 agencias gubernamentales. Propusieron un enfoque sistemático de análisis multinivel (inter-agencia, intra-agencia y análisis cruzado) que permite comparar la madurez entre diferentes unidades organizacionales y desarrollar hojas de ruta personalizadas [6].

Olaitan et al. (2019) desarrollaron un Modelo de Evaluación de Madurez de Gobernanza de Datos específico para departamentos gubernamentales, considerando que el contexto institucional (sector público vs. privado) requiere adaptaciones en las dimensiones evaluadas [7].
2.2 Enfoque basado en Métricas e Indicadores Clave (KPIs)

Earley (2016) propone un enfoque impulsado por métricas (metrics-driven governance), donde la gobernanza de la información se vincula directamente con marcos de métricas de datos y procesos. Argumenta que "implementar un enfoque basado en métricas para la gobernanza de la información toca muchos elementos de la empresa y puede tener efectos generalizados" [8].

Las métricas sugeridas se agrupan en categorías:
Categoría 	Ejemplos de indicadores
Calidad de datos 	Exactitud, completitud, consistencia, puntualidad, unicidad
Cumplimiento 	% de activos de datos con propietario asignado, % de datos críticos documentados
Operaciones 	Tiempo de resolución de incidentes de datos, productividad en gestión de datos
Valor de negocio 	Reducción de costos operativos, mejora en la toma de decisiones
2.3 Approach basado en Capacidades (Capability Approach)

Al-Badi et al. (2018) exploran los marcos de gobernanza para Big Data y destacan la importancia de evaluar capacidades organizacionales como la infraestructura tecnológica, las habilidades del personal, las políticas y procedimientos, y la cultura organizacional en torno a los datos [9].

Thordsen et al. (2020) realizan una evaluación crítica de los modelos de madurez digital, señalando que muchos modelos desarrollados por la práctica no cumplen con criterios académicos establecidos como la generalizabilidad o la interpretación basada en teoría. Recomiendan que cualquier modelo utilizado en investigación debe ser validado rigurosamente [10].
3. Metodología paso a paso para tu investigación

Basado en la literatura revisada, propongo la siguiente metodología estructurada para medir una mejora en la gobernanza de datos:
Paso 1: Diagnóstico inicial (Línea base)

    Selecciona un modelo de madurez validado (recomendado: MAMD [3], Stanford Maturity Model [4], o DMM [6]).
    Aplica un instrumento de evaluación (encuesta + entrevistas) a los actores clave (directivos, administradores de datos, usuarios).
    Calcula el nivel de madurez actual en cada dimensión (estructura organizacional, políticas, administración (stewardship), calidad de datos, gestión de metadatos, ciclo de vida de datos).

Paso 2: Definir la intervención de mejora

    Basado en el diagnóstico, identifica las brechas entre el nivel actual y el nivel objetivo (deseado por la organización).
    Diseña e implementa un plan de acción con iniciativas concretas (creación de comités, nombramiento de data stewards, implementación de políticas, herramientas de calidad, etc.).
    Establece KPIs específicos siguiendo el enfoque de Earley (2016) [8].

Paso 3: Medición post-intervención

    Después de un período definido (por ejemplo, 6-12 meses), reaplica el mismo instrumento de evaluación.
    Calcula el nivel de madurez alcanzado y compáralo con la línea base.
    Calcula la mejora como: Δ = (Nivel_post - Nivel_pre) / Nivel_pre × 100.

Paso 4: Análisis de resultados

    Utiliza el enfoque de análisis multinivel de Thomas et al. (2019) para examinar diferencias entre unidades [6].
    Aplica el método de brecha (gap analysis) entre el nivel actual y el nivel esperado [5].
    Triangula los resultados cuantitativos con evidencia cualitativa (entrevistas, observación documental).

4. Recomendaciones para el diseño de tu investigación

    Selecciona un marco teórico robusto: El marco conceptual de Abraham et al. (2019) [1] proporciona una base sólida con sus seis dimensiones y puede servir como modelo teórico para tu estudio.

    Utiliza instrumentos validados: Los cuestionarios basados en MAMD [3] o Stanford Maturity Model [4] han sido aplicados en múltiples contextos y ofrecen validez de contenido.

    Considera el contexto institucional: Olaitan et al. (2019) [7] demuestran que el sector (público, privado, salud, gobierno) influye en las dimensiones relevantes a evaluar.

    Incorpora múltiples perspectivas: Evalúa tanto a directivos como a personal operativo, ya que las percepciones pueden diferir significativamente (Kurniawan et al., 2019) [4].

    Documenta el proceso rigurosamente: Para que la investigación sea válida, Thordsen et al. (2020) [10] recomiendan asegurar que el modelo de medición cumpla con criterios de generalizabilidad, consistencia interna y validez predictiva.

    Vincula la gobernanza con resultados de negocio: Earley (2016) [8] enfatiza que la justificación de los programas de gobernanza debe conectarse con la mejora en resultados tangibles como reducción de costos, cumplimiento normativo y calidad en la toma de decisiones.

5. Ejemplo de indicadores concretos para tu investigación
Dimensión 	Indicador 	Método de medición
Estructura de gobierno 	Existencia de comité de datos formal 	Check-list / entrevista
Políticas 	% de políticas documentadas e implementadas 	Auditoría documental
Stewardship 	Número de data stewards designados por unidad 	Registro organizacional
Calidad de datos 	% de registros con errores en bases críticas 	Perfilamiento de datos
Metadatos 	% de activos de datos con metadatos documentados 	Revisión de catálogo
Ciclo de vida 	% de datos con políticas de retención definidas 	Auditoría de cumplimiento
Cultura organizacional 	Percepción de importancia de los datos (encuesta) 	Escala Likert
Referencias
[1]Abraham, Rene, et al. "Data Governance: A Conceptual Framework, Structured Review, and Research Agenda." International Journal of Information Management, vol. 49, diciembre de 2019, pp. 424–38. Crossref
DOI: 10.1016/j.ijinfomgt.2019.07.008
[2]Zhang, Qingqiang, et al. "Data Matters: A Strategic Action Framework for Data Governance." Information & Management, vol. 59, n.º 4, junio de 2022, p. 103642. Crossref
DOI: 10.1016/j.im.2022.103642
[3]Caballero, Ismael, et al. "A Maturity Model for Data Governance, Data Quality Management, and Data Management." Communications in Computer and Information Science, Springer Nature Switzerland, 2023, pp. 157–70. Crossref
DOI: 10.1007/978-3-031-40942-4_12
[4]Kurniawan, Dwitama Heryadi, et al. "Data Governance Maturity Assessment: A Case Study in IT Bureau of Audit Board." 2019 International Conference on Information Management and Technology (ICIMTech), 2019, pp. 629–34. Crossref
DOI: 10.1109/icimtech.2019.8843742
[5]Suroso, Jarot S., y Remi Indra Permana. "Data Governance Maturity Assessment at PT. XYZ. Case Study: Data Management Division." 2018 International Conference on Information Management and Technology (ICIMTech), 2018, pp. 295–300. Crossref
DOI: 10.1109/icimtech.2018.8528142
[6]Thomas, Manoj A., et al. "Data Management Maturity Assessment of Public Sector Agencies." Government Information Quarterly, vol. 36, n.º 4, octubre de 2019, p. 101401. Crossref
DOI: 10.1016/j.giq.2019.101401
[7]Olaitan, Olutoyin, et al. "A Data Governance Maturity Evaluation Model for Government Departments of the Eastern Cape Province, South Africa." SA Journal of Information Management, vol. 21, n.º 1, julio de 2019. Crossref
DOI: 10.4102/sajim.v21i1.996
[8]Earley, Seth. "Metrics-Driven Information Governance." IT Professional, vol. 18, n.º 2, marzo de 2016, pp. 17–21. Crossref
DOI: 10.1109/mitp.2016.26
[9]Al-Badi, Ali, et al. "Exploring Big Data Governance Frameworks." Procedia Computer Science, vol. 141, 2018, pp. 271–77. Crossref
DOI: 10.1016/j.procs.2018.10.181
[10]Thordsen, Tristan, et al. "How to Measure Digitalization? A Critical Evaluation of Digital Maturity Models." Lecture Notes in Computer Science, Springer International Publishing, 2020, pp. 358–69. Crossref
DOI: 10.1007/978-3-030-44999-5_30

Espero que esta guía te sea de gran utilidad para tu investigación. Como ves, la recomendación principal es que combines un modelo de madurez (como MAMD o Stanford) con un conjunto de KPIs para obtener una medición tanto cualitativa como cuantitativa de la mejora. Si necesitas profundizar en algún aspecto particular o adaptar la metodología a un sector específico, ¡avísame!


| Variable            | Dimensión | Indicador                        | Ítem (pregunta)                                        | Escala     |
| ------------------- | --------- | -------------------------------- | ------------------------------------------------------ | ---------- |
| Gobernanza de datos | Políticas | Existencia de políticas de datos | ¿Existen políticas formales para la gestión de datos?  | Likert 1–5 |
| Gobernanza de datos | Políticas | Nivel de cumplimiento            | ¿Se cumplen las normas de manejo de datos?             | Likert 1–5 |
| Gobernanza de datos | Roles     | Definición de responsables       | ¿Están definidos los responsables de los datos?        | Likert 1–5 |
| Gobernanza de datos | Roles     | Claridad de funciones            | ¿Las funciones sobre datos están claramente asignadas? | Likert 1–5 |
| Gobernanza de datos | Calidad   | Precisión de datos               | ¿Los datos son correctos y sin errores?                | Likert 1–5 |
| Gobernanza de datos | Calidad   | Actualización                    | ¿Los datos se actualizan regularmente?                 | Likert 1–5 |
| Gobernanza de datos | Seguridad | Protección de datos              | ¿Existen mecanismos de seguridad para los datos?       | Likert 1–5 |
| Gobernanza de datos | Seguridad | Control de accesos               | ¿El acceso a los datos está controlado?                | Likert 1–5 |
