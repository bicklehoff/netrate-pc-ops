// API: MISMO XML Export (Simplified)
// GET /api/portal/mlo/loans/:id/xml
// Exports a simplified MISMO 3.4-like XML for the loan file.
// This is a starting point — full MISMO compliance is Phase 3.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: true,
        mlo: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Decrypt PII for the export
    let ssn = '';
    let dob = '';
    try {
      ssn = loan.borrower.ssnEncrypted ? decrypt(loan.borrower.ssnEncrypted) : '';
      dob = loan.borrower.dobEncrypted ? decrypt(loan.borrower.dobEncrypted) : '';
    } catch {
      // If decryption fails, leave blank
    }

    const propAddr = loan.propertyAddress || {};
    const curAddr = loan.currentAddress || {};

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ABOUT_VERSIONS>
    <ABOUT_VERSION>
      <DataVersionIdentifier>NetRate Portal Export v1</DataVersionIdentifier>
      <DataVersionDate>${formatDate(new Date())}</DataVersionDate>
    </ABOUT_VERSION>
  </ABOUT_VERSIONS>
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <LOANS>
            <LOAN>
              <LOAN_IDENTIFIERS>
                <LOAN_IDENTIFIER>
                  <LoanIdentifier>${escapeXml(loan.id)}</LoanIdentifier>
                  <LoanIdentifierType>LenderLoan</LoanIdentifierType>
                </LOAN_IDENTIFIER>
              </LOAN_IDENTIFIERS>
              <TERMS_OF_LOAN>
                <LoanPurposeType>${escapeXml(loan.purpose?.toUpperCase() || '')}</LoanPurposeType>
                ${loan.purchasePrice ? `<NoteAmount>${Number(loan.purchasePrice)}</NoteAmount>` : ''}
              </TERMS_OF_LOAN>
            </LOAN>
          </LOANS>
          <PARTIES>
            <PARTY>
              <ROLES>
                <ROLE>
                  <BORROWER>
                    <BORROWER_DETAIL>
                      <MaritalStatusType>${escapeXml(loan.maritalStatus?.toUpperCase() || '')}</MaritalStatusType>
                      <DependentCount>${loan.numDependents || 0}</DependentCount>
                    </BORROWER_DETAIL>
                  </BORROWER>
                  <ROLE_DETAIL>
                    <PartyRoleType>Borrower</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
              <INDIVIDUAL>
                <NAME>
                  <FirstName>${escapeXml(loan.borrower.firstName)}</FirstName>
                  <LastName>${escapeXml(loan.borrower.lastName)}</LastName>
                </NAME>
                <CONTACT_POINTS>
                  <CONTACT_POINT>
                    <CONTACT_POINT_EMAIL>
                      <ContactPointEmailValue>${escapeXml(loan.borrower.email)}</ContactPointEmailValue>
                    </CONTACT_POINT_EMAIL>
                  </CONTACT_POINT>
                  ${loan.borrower.phone ? `<CONTACT_POINT>
                    <CONTACT_POINT_TELEPHONE>
                      <ContactPointTelephoneValue>${escapeXml(loan.borrower.phone)}</ContactPointTelephoneValue>
                    </CONTACT_POINT_TELEPHONE>
                  </CONTACT_POINT>` : ''}
                </CONTACT_POINTS>
              </INDIVIDUAL>
              <TAXPAYER_IDENTIFIERS>
                <TAXPAYER_IDENTIFIER>
                  <TaxpayerIdentifierType>SocialSecurityNumber</TaxpayerIdentifierType>
                  <TaxpayerIdentifierValue>${escapeXml(ssn)}</TaxpayerIdentifierValue>
                </TAXPAYER_IDENTIFIER>
              </TAXPAYER_IDENTIFIERS>
              ${dob ? `<BIRTH_DATE>${escapeXml(dob)}</BIRTH_DATE>` : ''}
              <RESIDENCES>
                <RESIDENCE>
                  <ADDRESS>
                    <AddressLineText>${escapeXml(curAddr.street || '')}</AddressLineText>
                    <CityName>${escapeXml(curAddr.city || '')}</CityName>
                    <StateCode>${escapeXml(curAddr.state || '')}</StateCode>
                    <PostalCode>${escapeXml(curAddr.zip || '')}</PostalCode>
                  </ADDRESS>
                </RESIDENCE>
              </RESIDENCES>
            </PARTY>
            <PARTY>
              <ROLES>
                <ROLE>
                  <ROLE_DETAIL>
                    <PartyRoleType>LoanOriginator</PartyRoleType>
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
              <INDIVIDUAL>
                <NAME>
                  <FirstName>${escapeXml(loan.mlo?.firstName || '')}</FirstName>
                  <LastName>${escapeXml(loan.mlo?.lastName || '')}</LastName>
                </NAME>
              </INDIVIDUAL>
            </PARTY>
          </PARTIES>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                <ADDRESS>
                  <AddressLineText>${escapeXml(propAddr.street || '')}</AddressLineText>
                  <CityName>${escapeXml(propAddr.city || '')}</CityName>
                  <StateCode>${escapeXml(propAddr.state || '')}</StateCode>
                  <PostalCode>${escapeXml(propAddr.zip || '')}</PostalCode>
                </ADDRESS>
                <PROPERTY_DETAIL>
                  <PropertyEstimatedValueAmount>${loan.estimatedValue ? Number(loan.estimatedValue) : ''}</PropertyEstimatedValueAmount>
                  <PropertyUsageType>${escapeXml(loan.occupancy?.toUpperCase() || '')}</PropertyUsageType>
                </PROPERTY_DETAIL>
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;

    // Create audit event
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'xml_export',
        actorType: 'mlo',
        actorId: session.user.id,
      },
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="loan-${id.substring(0, 8)}.xml"`,
      },
    });
  } catch (error) {
    console.error('XML export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
