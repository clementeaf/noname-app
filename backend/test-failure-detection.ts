import axios from 'axios';
import * as process from 'process';

const API_URL = 'http://localhost:3000/dev/conversation';
const TEST_PHONE = '+56999888777';

interface ConversationResponse {
  humanResponse: string;
  actionResult?: any;
  sessionId: string;
}

interface TestCase {
  name: string;
  message: string;
  expectedAction: string | null;
  expectedDataValidation?: (result: any) => boolean;
  expectedResponseContains?: string[];
  shouldNotContain?: string[];
  priority: 'critical' | 'high' | 'medium';
}

interface TestResult {
  testCase: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
  response: ConversationResponse;
}

async function sendMessage(message: string, phone: string = TEST_PHONE): Promise<ConversationResponse> {
  try {
    const response = await axios.post<ConversationResponse>(API_URL, { message, phone });
    return response.data;
  } catch (error: any) {
    throw new Error(`API Error: ${error.message}`);
  }
}

function validateTestCase(testCase: TestCase, response: ConversationResponse): TestResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // Validación 1: Acción backend esperada
  if (testCase.expectedAction !== null) {
    const hasAction = response.actionResult && response.actionResult.message !== 'No action to execute';

    if (testCase.expectedAction === 'any' && !hasAction) {
      failures.push(`Se esperaba ejecución de acción backend pero no se ejecutó ninguna`);
    } else if (testCase.expectedAction !== 'any') {
      if (!hasAction) {
        failures.push(`Se esperaba acción "${testCase.expectedAction}" pero no se ejecutó ninguna acción`);
      }
    }
  } else {
    // No se espera acción
    const hasAction = response.actionResult && response.actionResult.message !== 'No action to execute';
    if (hasAction) {
      warnings.push(`No se esperaba acción backend pero se ejecutó una`);
    }
  }

  // Validación 2: Validación de datos personalizada
  if (testCase.expectedDataValidation && response.actionResult) {
    const isValid = testCase.expectedDataValidation(response.actionResult);
    if (!isValid) {
      failures.push(`Los datos retornados no cumplen la validación esperada`);
    }
  }

  // Validación 3: Contenido esperado en respuesta
  if (testCase.expectedResponseContains) {
    testCase.expectedResponseContains.forEach(expected => {
      if (!response.humanResponse.toLowerCase().includes(expected.toLowerCase())) {
        failures.push(`La respuesta no contiene el texto esperado: "${expected}"`);
      }
    });
  }

  // Validación 4: Contenido NO esperado en respuesta
  if (testCase.shouldNotContain) {
    testCase.shouldNotContain.forEach(unexpected => {
      if (response.humanResponse.toLowerCase().includes(unexpected.toLowerCase())) {
        failures.push(`La respuesta contiene texto NO esperado: "${unexpected}"`);
      }
    });
  }

  return {
    testCase: testCase.name,
    passed: failures.length === 0,
    failures,
    warnings,
    response
  };
}

function printResult(result: TestResult, testCase: TestCase) {
  const icon = result.passed ? '✅' : '❌';
  const priorityIcon = testCase.priority === 'critical' ? '🔴' : testCase.priority === 'high' ? '🟡' : '🔵';

  console.log(`\n${icon} ${priorityIcon} ${result.testCase} - ${result.passed ? 'PASSED' : 'FAILED'}`);

  if (result.failures.length > 0) {
    console.log(`\n  ❌ FALLOS (${result.failures.length}):`);
    result.failures.forEach((failure, i) => {
      console.log(`     ${i + 1}. ${failure}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log(`\n  ⚠️  ADVERTENCIAS (${result.warnings.length}):`);
    result.warnings.forEach((warning, i) => {
      console.log(`     ${i + 1}. ${warning}`);
    });
  }

  console.log(`\n  💬 Respuesta: ${result.response.humanResponse.substring(0, 150)}...`);

  if (result.response.actionResult && result.response.actionResult.message !== 'No action to execute') {
    console.log(`  🔧 Acción ejecutada: SÍ`);
  } else {
    console.log(`  🔧 Acción ejecutada: NO`);
  }
}

async function runFailureDetection() {
  console.log('\n🔍 INICIANDO DETECCIÓN AVANZADA DE FALLOS\n');
  console.log('🔴 = Crítico | 🟡 = Alto | 🔵 = Medio\n');

  const testCases: TestCase[] = [
    {
      name: 'Query: Consulta de cuentas con RUT explícito',
      message: 'Hola, quiero consultar mis cuentas asociadas al RUT 12345678-9',
      expectedAction: 'any',
      expectedDataValidation: (result) => Array.isArray(result) && result.length > 0,
      shouldNotContain: ['confirma', 'confirmar'],
      priority: 'critical'
    },
    {
      name: 'Query: Listar facturas pendientes (requiere contexto previo)',
      message: 'Muéstrame las facturas pendientes de todas mis cuentas',
      expectedAction: 'any',
      expectedDataValidation: (result) => {
        // Puede retornar array vacío si no hay contexto de cuentas
        return result !== undefined;
      },
      shouldNotContain: ['confirma', 'confirmar'],
      priority: 'high'
    },
    {
      name: 'Query: Buscar cuentas de otro RUT',
      message: 'Consulta las cuentas del RUT 98765432-1',
      expectedAction: 'any',
      expectedDataValidation: (result) => Array.isArray(result),
      shouldNotContain: ['confirma', 'confirmar'],
      priority: 'critical'
    },
    {
      name: 'Conversational: Saludo inicial',
      message: 'Hola',
      expectedAction: null,
      expectedResponseContains: ['hola', 'ayudar'],
      priority: 'medium'
    },
    {
      name: 'Sensitive: Solicitud de pago (debe pedir PIN)',
      message: 'Quiero pagar mi factura de Enel',
      expectedAction: null,
      expectedResponseContains: ['PIN', 'pin'],
      priority: 'critical'
    },
    {
      name: 'Query: Solicitud ambigua sin datos',
      message: 'Muestra mis cuentas',
      expectedAction: null,
      expectedResponseContains: ['RUT', 'rut'],
      priority: 'high'
    },
    {
      name: 'Query: Facturas con account_id específico',
      message: 'Muestra las facturas de la cuenta 3c6d66b3-2b5d-4132-aad1-ba3eccf4b47a',
      expectedAction: 'any',
      priority: 'high'
    },
    {
      name: 'Edge case: RUT inválido',
      message: 'Consulta las cuentas del RUT 00000000-0',
      expectedAction: 'any',
      expectedDataValidation: (result) => Array.isArray(result) && result.length === 0,
      priority: 'medium'
    },
    {
      name: 'Conversational: Pregunta sobre métodos de pago',
      message: '¿Qué métodos de pago aceptan?',
      expectedAction: null,
      expectedResponseContains: ['tarjeta', 'banco', 'cripto'],
      priority: 'medium'
    },
    {
      name: 'Context test: Segunda query en misma sesión',
      message: 'Ahora muestra las facturas pendientes',
      expectedAction: 'any',
      priority: 'high'
    }
  ];

  const results: TestResult[] = [];
  let sessionId: string | null = null;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`   Mensaje: "${testCase.message}"`);

    try {
      // Usar misma sesión para tests de contexto
      const phone = sessionId && testCase.name.includes('Context test') ? TEST_PHONE : `+569${Math.floor(Math.random() * 100000000)}`;

      const response = await sendMessage(testCase.message, phone);
      sessionId = response.sessionId;

      const result = validateTestCase(testCase, response);
      results.push(result);
      printResult(result, testCase);

      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.log(`\n❌ ERROR CRÍTICO: ${error.message}`);
      results.push({
        testCase: testCase.name,
        passed: false,
        failures: [error.message],
        warnings: [],
        response: { humanResponse: '', sessionId: '' }
      });
    }
  }

  // REPORTE FINAL
  console.log('\n' + '='.repeat(80));
  console.log('📊 REPORTE FINAL DE DETECCIÓN DE FALLOS');
  console.log('='.repeat(80));

  const criticalFailures = results.filter(r => !r.passed && testCases.find(tc => tc.name === r.testCase)?.priority === 'critical');
  const highFailures = results.filter(r => !r.passed && testCases.find(tc => tc.name === r.testCase)?.priority === 'high');
  const mediumFailures = results.filter(r => !r.passed && testCases.find(tc => tc.name === r.testCase)?.priority === 'medium');

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`\n✅ Tests exitosos: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`❌ Tests fallidos: ${failedTests}/${totalTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);

  if (criticalFailures.length > 0) {
    console.log(`\n🔴 FALLOS CRÍTICOS (${criticalFailures.length}):`);
    criticalFailures.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.testCase}`);
      result.failures.forEach(f => console.log(`      - ${f}`));
    });
  }

  if (highFailures.length > 0) {
    console.log(`\n🟡 FALLOS DE ALTA PRIORIDAD (${highFailures.length}):`);
    highFailures.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.testCase}`);
      result.failures.forEach(f => console.log(`      - ${f}`));
    });
  }

  if (mediumFailures.length > 0) {
    console.log(`\n🔵 FALLOS DE PRIORIDAD MEDIA (${mediumFailures.length}):`);
    mediumFailures.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.testCase}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  if (criticalFailures.length > 0) {
    console.log('\n🚨 RESULTADO: SISTEMA CON FALLOS CRÍTICOS - REQUIERE ATENCIÓN INMEDIATA');
    process.exit(1);
  } else if (highFailures.length > 0) {
    console.log('\n⚠️  RESULTADO: SISTEMA CON FALLOS DE ALTA PRIORIDAD - REVISAR');
    process.exit(1);
  } else if (failedTests > 0) {
    console.log('\n✅ RESULTADO: SISTEMA FUNCIONAL CON MEJORAS PENDIENTES');
  } else {
    console.log('\n🎉 RESULTADO: TODOS LOS TESTS PASARON EXITOSAMENTE');
  }

  console.log('');
}

runFailureDetection();
