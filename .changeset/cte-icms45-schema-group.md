---
'@adatechnology/fiscal-provider': patch
---

CT-e 4.00: CST 40/41/51 passa a usar o grupo `ICMS45`

`buildCteXml` emitia `<ICMS40>` para as situações tributárias 40 (isenção), 41 (não tributada) e 51
(diferimento). `ICMS40` não existe no schema do CT-e — é grupo da NF-e. No CT-e as três CST ficam
todas em `ICMS45`, conforme `cteTiposBasico_v4.00.xsd`:

```xml
<xs:complexType name="TImp">
  <xs:choice>
    <xs:element name="ICMS00"/> <xs:element name="ICMS20"/> <xs:element name="ICMS45"/>
    <xs:element name="ICMS60"/> <xs:element name="ICMS90"/> <xs:element name="ICMSOutraUF"/>
    <xs:element name="ICMSSN"/>
  </xs:choice>
</xs:complexType>
```

`ICMS45` documenta "ICMS Isento, não Tributado ou diferido" e enumera `CST` em `40 | 41 | 51`. A
string `ICMS40` não aparece nenhuma vez no schema do CT-e 4.00.

Provado com `xmllint` contra o XSD oficial (PL_CTe_400), em CT-e assinado:

```
antes: Element 'ICMS40': This element is not expected. Expected is one of
       ( ICMS00, ICMS20, ICMS45, ICMS60, ICMS90, ICMSOutraUF, ICMSSN ).
depois: cte-40.xml validates · cte-41.xml validates · cte-51.xml validates
```

O ramo `default` de `buildIcms` (CST desconhecida) também passa a cair em `ICMS45` com CST 41.

O grupo `ICMS40` da NF-e (`SefazXmlBuilder.ts`) está correto e não foi tocado — lá ele existe no
schema e carrega `orig`.
