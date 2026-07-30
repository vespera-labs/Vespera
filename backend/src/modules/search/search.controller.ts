import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService, SearchFilters } from './search.service';
import {
  PropertyType,
  ListingStatus,
} from '../properties/entities/property.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import {
  discoveryTenantContext,
  landlordTenantContext,
} from './tenant-context';
import { SearchScopeError } from './search-scope.error';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Tenant-scoped discovery search. Tenant identity is derived from the
   * authenticated principal — never from query parameters (tenantId/visibility
   * overrides are ignored if present).
   */
  @Get('listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Tenant-scoped property search (ES). Scope is server-derived from JWT.',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({ name: 'bedrooms', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async queryListings(
    @CurrentUser() user: User,
    @Query('q') query?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
    @Query('type') type?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('bathrooms') bathrooms?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    // Intentionally accepted then discarded — never trusted for scope.
    @Query('tenantId') _tenantId?: string,
    @Query('visibility') _visibility?: string,
  ) {
    void _tenantId;
    void _visibility;

    const tenant = this.deriveTenantContext(user);
    return this.searchService.query(tenant, {
      query,
      city,
      state,
      country,
      type,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 20,
    });
  }

  @Get('properties')
  @Public()
  @ApiOperation({ summary: 'Full-text property search with faceted filtering' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'type', required: false, enum: PropertyType })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({ name: 'bedrooms', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'radiusKm', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async searchProperties(
    @Query('q') query?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
    @Query('type') type?: PropertyType,
    @Query('status') status?: ListingStatus,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('bathrooms') bathrooms?: string,
    @Query('furnished') furnished?: string,
    @Query('parking') parking?: string,
    @Query('petsAllowed') petsAllowed?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: SearchFilters = {
      query,
      city,
      state,
      country,
      type,
      // Client-supplied status is ignored for public discovery — always published.
      status: ListingStatus.PUBLISHED,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
      isFurnished: furnished !== undefined ? furnished === 'true' : undefined,
      hasParking: parking !== undefined ? parking === 'true' : undefined,
      petsAllowed:
        petsAllowed !== undefined ? petsAllowed === 'true' : undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
    };
    void status;
    return this.searchService.searchProperties(
      filters,
      page ? parseInt(page) : 1,
      limit ? Math.min(parseInt(limit), 100) : 20,
    );
  }

  @Get('suggest')
  @Public()
  @ApiOperation({ summary: 'Autocomplete suggestions for search' })
  @ApiQuery({ name: 'q', required: true })
  async suggest(@Query('q') q: string) {
    return this.searchService.suggest(q);
  }

  private deriveTenantContext(user: User) {
    if (!user?.id) {
      throw new SearchScopeError('Authenticated principal has no tenant id');
    }
    if (
      user.role === UserRole.LANDLORD ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.AGENT
    ) {
      return landlordTenantContext(user.id);
    }
    return discoveryTenantContext(user.id);
  }
}
