import React from 'react';
import { Check, Minus } from 'lucide-react';

/**
 * ComparisonTable — Feature comparison across plans.
 */
const ComparisonTable = ({ content = {}, config = {} }) => {
  const plans = config.plans || ['Starter', 'Professional', 'Brand'];
  const rows = content.rows || [];

  return (
    <section className="py-24 bg-white overflow-x-auto" data-testid="comparison-table">
      <div className="max-w-5xl mx-auto px-8 md:px-16">
        {content.headline && (
          <h2 className="font-serif font-light text-4xl text-[#0A0A0A] tracking-tighter mb-16">
            {content.headline}
          </h2>
        )}
        <table className="w-full border-t border-[rgba(10,10,10,0.1)]">
          <thead>
            <tr>
              <th className="text-left py-6 pr-8 w-1/3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A5A]">Features</span>
              </th>
              {plans.map((plan, i) => (
                <th key={i} className="text-center py-6 px-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#0A0A0A]">{plan}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[rgba(10,10,10,0.08)]" data-testid={`comparison-row-${i}`}>
                <td className="py-4 pr-8 text-sm text-[#0A0A0A] font-medium">{row.label}</td>
                {plans.map((_, j) => {
                  const val = row.values?.[j];
                  return (
                    <td key={j} className="py-4 px-4 text-center">
                      {val === true ? (
                        <Check size={16} className="mx-auto text-[#3DDAD0]" />
                      ) : val === false || val === undefined ? (
                        <Minus size={14} className="mx-auto text-[rgba(10,10,10,0.2)]" />
                      ) : (
                        <span className="text-xs text-[#5A5A5A]">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ComparisonTable;
