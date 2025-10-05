import axios from 'axios';
import * as process from 'process';

const API_URL = 'http://localhost:3000/dev/conversation';
const TEST_PHONE = '+56912345678';

interface ConversationResponse {
  humanResponse: string;
  actionResult?: any;
  sessionId: string;
}

async function sendMessage(message: string, phone: string = TEST_PHONE): Promise<ConversationResponse> {
  try {
    const response = await axios.post<ConversationResponse>(API_URL, { message, phone });
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

function logResponse(scenario: string, response: ConversationResponse) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 ESCENARIO: ${scenario}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\n💬 Respuesta al usuario:\n${response.humanResponse}`);

  if (response.actionResult) {
    console.log(`\n🔧 Resultado backend:`);
    console.log(JSON.stringify(response.actionResult, null, 2));
  }

  console.log(`\n🆔 Session ID: ${response.sessionId}`);
}

async function runTests() {
  console.log('\n🚀 INICIANDO TEST CONVERSACIONAL\n');

  try {
    // ESCENARIO 1: Consultar cuentas asociadas al RUT
    console.log('▶️  Ejecutando Escenario 1...');
    const response1 = await sendMessage(
      'Hola, quiero consultar mis cuentas asociadas al RUT 12345678-9'
    );
    logResponse('Consulta de cuentas por RUT', response1);

    // Validación: NO debe pedir confirmación
    if (response1.humanResponse.toLowerCase().includes('confirma')) {
      console.log('❌ FALLO: El agente está pidiendo confirmación en una query');
    } else {
      console.log('✅ ÉXITO: El agente ejecutó la query inmediatamente');
    }

    // Validación: Debe tener datos de cuentas
    if (response1.actionResult && Array.isArray(response1.actionResult) && response1.actionResult.length > 0) {
      console.log(`✅ ÉXITO: Se encontraron ${response1.actionResult.length} cuentas`);
    } else {
      console.log('❌ FALLO: No se encontraron cuentas o formato incorrecto');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ESCENARIO 2: Listar facturas pendientes
    console.log('\n▶️  Ejecutando Escenario 2...');
    const response2 = await sendMessage(
      'Muéstrame las facturas pendientes de todas mis cuentas'
    );
    logResponse('Listar facturas pendientes', response2);

    // Validación: NO debe pedir confirmación
    if (response2.humanResponse.toLowerCase().includes('confirma')) {
      console.log('❌ FALLO: El agente está pidiendo confirmación en una query');
    } else {
      console.log('✅ ÉXITO: El agente ejecutó la query inmediatamente');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ESCENARIO 3: Iniciar pago (debe pedir PIN)
    console.log('\n▶️  Ejecutando Escenario 3...');
    const response3 = await sendMessage(
      'Quiero pagar la factura de Enel con tarjeta'
    );
    logResponse('Solicitud de pago', response3);

    // Validación: DEBE pedir PIN para pagos
    if (response3.humanResponse.toLowerCase().includes('pin')) {
      console.log('✅ ÉXITO: El agente solicita PIN para operación sensible');
    } else {
      console.log('⚠️  ADVERTENCIA: El agente no está solicitando PIN para el pago');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ESCENARIO 4: Usuario pregunta algo genérico
    console.log('\n▶️  Ejecutando Escenario 4...');
    const response4 = await sendMessage(
      '¿Qué métodos de pago aceptan?'
    );
    logResponse('Pregunta informativa', response4);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ESCENARIO 5: Usuario con RUT diferente
    console.log('\n▶️  Ejecutando Escenario 5...');
    const response5 = await sendMessage(
      'Consulta las cuentas del RUT 98765432-1'
    );
    logResponse('Consulta de otro RUT', response5);

    if (response5.actionResult && Array.isArray(response5.actionResult) && response5.actionResult.length > 0) {
      console.log(`✅ ÉXITO: Se encontraron ${response5.actionResult.length} cuentas para el segundo usuario`);
    }

    // RESUMEN FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN DE TESTS COMPLETADOS');
    console.log('='.repeat(80));
    console.log('✅ Escenario 1: Consulta de cuentas - Completado');
    console.log('✅ Escenario 2: Listar facturas - Completado');
    console.log('✅ Escenario 3: Iniciar pago - Completado');
    console.log('✅ Escenario 4: Pregunta informativa - Completado');
    console.log('✅ Escenario 5: Consulta otro RUT - Completado');
    console.log('\n🎉 TESTS FINALIZADOS\n');

  } catch (error) {
    console.error('\n💥 ERROR EN EJECUCIÓN DE TESTS:', error);
    process.exit(1);
  }
}

runTests();
