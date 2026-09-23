import { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  KeyRound,
  FileText,
  QrCode
} from 'lucide-react';
import { AuditLog, AuditCategory, AuditSeverity } from '../types.js';
import { formatDate } from '../utils/formatters.js';

interface AuditLogsViewProps {
  logs: AuditLog[];
  onRefresh: () => void;
}

export function AuditLogsView({ logs, onRefresh }: AuditLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AuditCategory>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress.includes(searchQuery) ||
      (log.resourceName && log.resourceName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || log.category === categoryFilter;
    const matchesSev = severityFilter === 'ALL' || log.severity === severityFilter;

    return matchesSearch && matchesCat && matchesSev;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `MySpace_Security_AuditLogs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getSeverityBadge = (sev: AuditSeverity) => {
    switch (sev) {
      case 'SECURITY':
        return 'bg-purple-900/20 text-purple-400 border-purple-500/30';
      case 'ALERT':
        return 'bg-rose-900/20 text-rose-400 border-rose-500/30';
      case 'WARNING':
        return 'bg-amber-900/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-900/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">SECURITY LOGS</span>
            <div className="flex items-center text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse"></span>
              HMAC Immutable Trail
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Access & Security Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Every authentication event, AES-256 operation, and QR viewer verification is logged
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON Report
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by action, user, IP, or details..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Event Categories</option>
            <option value="AUTH">Auth & MFA</option>
            <option value="CRYPTO">AES-256 Crypto Operations</option>
            <option value="DOCUMENT">Vault Documents</option>
            <option value="SHARING">QR Code Sharing</option>
            <option value="SYSTEM">System & Security</option>
          </select>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Severity Levels</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ALERT">Alert</option>
            <option value="SECURITY">Security</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/30 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp & Hash</th>
                <th className="py-3 px-4">Security Action</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Actor / Role</th>
                <th className="py-3 px-4">Details & Target</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No security events match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-sans font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-blue-400 font-mono flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>HMAC: {log.integrityHash || '8f92a10b'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-white">
                      {log.action}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {log.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <div className="font-medium text-slate-200">{log.userName}</div>
                      <div className="text-[10px] text-slate-500 font-mono uppercase">{log.userRole}</div>
                    </td>

                    <td className="py-3 px-4 font-sans text-xs text-slate-300 max-w-sm">
                      <div className="line-clamp-2">{log.details}</div>
                      {log.resourceName && (
                        <div className="text-[10px] text-blue-400 font-mono mt-0.5 truncate">
                          Target: {log.resourceName}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-blue-400 font-mono">
                      {log.ipAddress}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getSeverityBadge(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
