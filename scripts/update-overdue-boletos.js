"use strict";
/**
 * Script automático para atualizar status de boletos vencidos
 * Deve ser executado diariamente às 00:00 (horário de Brasília)
 *
 * Funcionalidades:
 * - Atualiza boletos PENDING → OVERDUE quando dueDate < hoje
 * - Registra logs detalhados de cada atualização
 * - Envia notificações para clientes (opcional)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOverdueBoletos = void 0;
require("dotenv/config");
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
/**
 * Calcula o início do dia atual em horário de Brasília (UTC-3)
 * Retorna a data em UTC equivalente a 00:00 de Brasília
 */
function getBrasiliaToday() {
    var now = new Date();
    // Brasília está em UTC-3
    var brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    // Obtém ano, mês e dia em horário de Brasília
    var year = brasiliaTime.getUTCFullYear();
    var month = brasiliaTime.getUTCMonth();
    var day = brasiliaTime.getUTCDate();
    // Retorna 00:00 do dia atual em Brasília (convertido para UTC)
    return new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
}
function updateOverdueBoletos() {
    return __awaiter(this, void 0, void 0, function () {
        var brasiliaToday_1, overdueBoletos, updatePromises, results, successCount, failureCount, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🔄 [UPDATE_OVERDUE_BOLETOS] Iniciando atualização de boletos vencidos...');
                    console.log("\uD83D\uDCC5 Data/hora de execu\u00E7\u00E3o: ".concat(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 7]);
                    brasiliaToday_1 = getBrasiliaToday();
                    console.log("\uD83D\uDCCD [UPDATE_OVERDUE_BOLETOS] Refer\u00EAncia (00:00 Bras\u00EDlia em UTC): ".concat(brasiliaToday_1.toISOString()));
                    return [4 /*yield*/, prisma.boleto.findMany({
                            where: {
                                status: 'PENDING',
                                dueDate: {
                                    lt: brasiliaToday_1 // Vencimento ANTERIOR ao início de hoje
                                }
                            },
                            include: {
                                Customer: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        phone: true
                                    }
                                },
                                Order: {
                                    select: {
                                        id: true,
                                        orderNumber: true,
                                        total: true
                                    }
                                }
                            }
                        })];
                case 2:
                    overdueBoletos = _a.sent();
                    console.log("\uD83D\uDCCA [UPDATE_OVERDUE_BOLETOS] Boletos encontrados para atualizar: ".concat(overdueBoletos.length));
                    if (overdueBoletos.length === 0) {
                        console.log('✅ [UPDATE_OVERDUE_BOLETOS] Nenhum boleto vencido encontrado. Sistema está em dia!');
                        return [2 /*return*/, {
                                success: true,
                                updated: 0,
                                message: 'Nenhum boleto vencido encontrado'
                            }];
                    }
                    updatePromises = overdueBoletos.map(function (boleto) { return __awaiter(_this, void 0, void 0, function () {
                        var diasAtraso, error_2;
                        var _a, _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    diasAtraso = Math.floor((brasiliaToday_1.getTime() - boleto.dueDate.getTime()) / (1000 * 60 * 60 * 24));
                                    console.log("\u26A0\uFE0F [UPDATE_OVERDUE_BOLETOS] Atualizando boleto:");
                                    console.log("   ID: ".concat(boleto.id));
                                    console.log("   Cliente: ".concat(((_a = boleto.Customer) === null || _a === void 0 ? void 0 : _a.name) || 'N/A'));
                                    console.log("   Pedido: ".concat(((_b = boleto.Order) === null || _b === void 0 ? void 0 : _b.orderNumber) || 'N/A'));
                                    console.log("   Valor: R$ ".concat(boleto.amount));
                                    console.log("   Vencimento: ".concat(boleto.dueDate.toLocaleDateString('pt-BR')));
                                    console.log("   Dias de atraso: ".concat(diasAtraso));
                                    _e.label = 1;
                                case 1:
                                    _e.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, prisma.boleto.update({
                                            where: { id: boleto.id },
                                            data: {
                                                status: 'OVERDUE',
                                                updatedAt: new Date()
                                            }
                                        })];
                                case 2:
                                    _e.sent();
                                    console.log("   \u2705 Status atualizado para OVERDUE");
                                    // TODO: Enviar notificação para o cliente
                                    // await sendOverdueNotification(boleto);
                                    return [2 /*return*/, {
                                            success: true,
                                            boletoId: boleto.id,
                                            customerName: (_c = boleto.Customer) === null || _c === void 0 ? void 0 : _c.name,
                                            orderNumber: (_d = boleto.Order) === null || _d === void 0 ? void 0 : _d.orderNumber,
                                            diasAtraso: diasAtraso
                                        }];
                                case 3:
                                    error_2 = _e.sent();
                                    console.error("   \u274C Erro ao atualizar boleto ".concat(boleto.id, ":"), error_2);
                                    return [2 /*return*/, {
                                            success: false,
                                            boletoId: boleto.id,
                                            error: error_2.message
                                        }];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(updatePromises)];
                case 3:
                    results = _a.sent();
                    successCount = results.filter(function (r) { return r.success; }).length;
                    failureCount = results.filter(function (r) { return !r.success; }).length;
                    console.log('\n📈 [UPDATE_OVERDUE_BOLETOS] Resumo da execução:');
                    console.log("   \u2705 Atualizados com sucesso: ".concat(successCount));
                    console.log("   \u274C Falhas: ".concat(failureCount));
                    console.log("   \uD83D\uDCCA Total processado: ".concat(overdueBoletos.length));
                    if (failureCount > 0) {
                        console.log('\n⚠️ [UPDATE_OVERDUE_BOLETOS] Boletos com falha:');
                        results
                            .filter(function (r) { return !r.success; })
                            .forEach(function (r) { return console.log("   - Boleto ".concat(r.boletoId, ": ").concat(r.error)); });
                    }
                    return [2 /*return*/, {
                            success: true,
                            updated: successCount,
                            failed: failureCount,
                            total: overdueBoletos.length,
                            details: results
                        }];
                case 4:
                    error_1 = _a.sent();
                    console.error('❌ [UPDATE_OVERDUE_BOLETOS] Erro crítico na execução:', error_1);
                    throw error_1;
                case 5: return [4 /*yield*/, prisma.$disconnect()];
                case 6:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.updateOverdueBoletos = updateOverdueBoletos;
// Execução direta (quando rodado como script standalone)
if (require.main === module) {
    updateOverdueBoletos()
        .then(function (result) {
        console.log('\n✅ [UPDATE_OVERDUE_BOLETOS] Execução concluída com sucesso!');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    })
        .catch(function (error) {
        console.error('\n❌ [UPDATE_OVERDUE_BOLETOS] Execução falhou:', error);
        process.exit(1);
    });
}
